"""Career recommendations for the logged-in user (profile required)."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from engine.catalog_data import get_catalog
from engine.context import build_context
from engine.recommend import confidence, reachable_careers, recommend, score_career
from models import User
from routes.next_steps import REFERENCE_DATA_MISSING
from services.auth import get_current_user

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

NO_PROFILE = HTTPException(status.HTTP_404_NOT_FOUND, "Create your profile first to get recommendations.")


def _load(db: Session, user: User):
    catalog = get_catalog(db)
    if catalog.is_empty:
        raise REFERENCE_DATA_MISSING
    ctx = build_context(db, catalog, user.id)
    if not ctx.has_profile:
        raise NO_PROFILE
    return catalog, ctx


@router.get("")
def list_recommendations(
    domain: str | None = Query(default=None, max_length=60),
    limit: int = Query(default=10, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    catalog, ctx = _load(db, user)
    result = recommend(catalog, ctx, domain=domain, limit=limit)
    result["stage"] = {"stage_id": ctx.stage.stage_id, "note": ctx.stage.note,
                       "name": catalog.stage_name(ctx.stage.stage_id) if ctx.stage.stage_id else None}
    result["unmatched_skills"] = ctx.unmatched_skills
    return result


@router.get("/{career_id}")
def explain_career(career_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    catalog, ctx = _load(db, user)
    career = catalog.careers.get(career_id)
    if career is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Career not found.")
    item = score_career(catalog, ctx, career, reachable_careers(catalog, ctx.stage.stage_id))
    ranking = recommend(catalog, ctx, limit=len(catalog.careers))["items"]
    item["rank"] = next(i for i, r in enumerate(ranking, 1) if r["career_id"] == career_id)
    item["out_of"] = len(ranking)
    item["confidence"] = confidence(ctx)
    return item
