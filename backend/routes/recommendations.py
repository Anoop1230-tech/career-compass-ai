"""Career recommendations for the logged-in user (profile required),
plus "did this fit you?" feedback on each recommendation."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from services.lang import Localizer, request_lang
from engine.catalog_data import get_catalog
from engine.context import build_context
from engine.recommend import confidence, reachable_careers, recommend, score_career
from models import RecommendationFeedback, User
from routes.next_steps import REFERENCE_DATA_MISSING
from services.auth import get_current_user

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

NO_PROFILE = HTTPException(status.HTTP_404_NOT_FOUND, "Create your profile first to get recommendations.")
CAREER_NOT_FOUND = HTTPException(status.HTTP_404_NOT_FOUND, "Career not found.")

# Why a match does not fit: lets the engine's weak spots be found later without free text (no personal details)
Reason = Literal["not_interested", "too_hard_to_reach", "skills_mismatch", "pay_or_lifestyle", "other"]


class FeedbackIn(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    verdict: Literal["fits", "not_for_me"]
    reason: Reason | None = None


def _load(db: Session, user: User):
    catalog = get_catalog(db)
    if catalog.is_empty:
        raise REFERENCE_DATA_MISSING
    ctx = build_context(db, catalog, user.id)
    if not ctx.has_profile:
        raise NO_PROFILE
    return catalog, ctx


def _feedback_out(row: RecommendationFeedback | None) -> dict | None:
    return {"verdict": row.verdict, "reason": row.reason} if row else None


def _feedback_by_career(db: Session, user_id: int) -> dict[str, RecommendationFeedback]:
    rows = db.scalars(select(RecommendationFeedback).where(RecommendationFeedback.user_id == user_id))
    return {r.career_id: r for r in rows}


@router.get("")
def list_recommendations(
    domain: str | None = Query(default=None, max_length=60),
    limit: int = Query(default=10, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: str = Depends(request_lang),
):
    catalog, ctx = _load(db, user)
    tr = Localizer(db, lang)
    result = recommend(catalog, ctx, domain=domain, limit=limit)
    feedback = _feedback_by_career(db, user.id)
    for item in result["items"]:
        item["feedback"] = _feedback_out(feedback.get(item["career_id"]))
        tr.career(item)
    stage_id = ctx.stage.stage_id
    result["stage"] = {"stage_id": stage_id, "note": ctx.stage.note,
                       "name": tr("stage", stage_id, "name", catalog.stage_name(stage_id)) if stage_id else None}
    result["unmatched_skills"] = ctx.unmatched_skills
    return result


@router.get("/feedback")
def my_feedback(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Everything you have answered (your own data, for transparency)."""
    rows = db.scalars(select(RecommendationFeedback).where(RecommendationFeedback.user_id == user.id)
                      .order_by(RecommendationFeedback.updated_at.desc())).all()
    return {"items": [{"career_id": r.career_id, "verdict": r.verdict, "reason": r.reason, "score": r.score,
                       "rank": r.rank, "updated_at": r.updated_at.isoformat()} for r in rows]}


def _ranked(catalog, ctx, career_id: str) -> tuple[dict, int, int]:
    career = catalog.careers.get(career_id)
    if career is None:
        raise CAREER_NOT_FOUND
    item = score_career(catalog, ctx, career, reachable_careers(catalog, ctx.stage.stage_id))
    ranking = recommend(catalog, ctx, limit=len(catalog.careers))["items"]
    rank = next((i for i, r in enumerate(ranking, 1) if r["career_id"] == career_id), len(ranking))
    return item, rank, len(ranking)


@router.get("/{career_id}")
def explain_career(career_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    catalog, ctx = _load(db, user)
    item, rank, out_of = _ranked(catalog, ctx, career_id)
    item["rank"] = rank
    item["out_of"] = out_of
    item["confidence"] = confidence(ctx)
    item["feedback"] = _feedback_out(_feedback_by_career(db, user.id).get(career_id))
    return item


@router.put("/{career_id}/feedback")
def save_feedback(career_id: str, body: FeedbackIn, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    catalog, ctx = _load(db, user)
    item, rank, _ = _ranked(catalog, ctx, career_id)
    reason = body.reason if body.verdict == "not_for_me" else None  # a reason only explains a "no"
    row = db.scalar(select(RecommendationFeedback).where(
        RecommendationFeedback.user_id == user.id, RecommendationFeedback.career_id == career_id))
    if row is None:
        row = RecommendationFeedback(user_id=user.id, career_id=career_id)
        db.add(row)
    row.verdict, row.reason = body.verdict, reason
    # Snapshot of what the engine said when the user answered
    row.score, row.rank, row.confidence = round(item["score"], 1), rank, confidence(ctx)["percent"]
    try:
        db.commit()
    except IntegrityError:  # two clicks at once: the other request saved first; update that row instead
        db.rollback()
        row = db.scalar(select(RecommendationFeedback).where(
            RecommendationFeedback.user_id == user.id, RecommendationFeedback.career_id == career_id))
        row.verdict, row.reason = body.verdict, reason
        db.commit()
    return {"career_id": career_id, "feedback": _feedback_out(row)}


@router.delete("/{career_id}/feedback", status_code=status.HTTP_204_NO_CONTENT)
def delete_feedback(career_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(delete(RecommendationFeedback).where(
        RecommendationFeedback.user_id == user.id, RecommendationFeedback.career_id == career_id))
    db.commit()
