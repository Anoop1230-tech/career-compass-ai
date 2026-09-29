"""Roadmap API. Anyone can view a roadmap; logged-in users get it
personalised, can set a target career and tick off skills as learned."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, StrictBool
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from database import get_db
from engine.catalog_data import get_catalog
from engine.context import build_context
from engine.roadmap import UnknownCareer, build_roadmap
from models import RoadmapProgress, User
from routes.next_steps import REFERENCE_DATA_MISSING
from services.auth import get_current_user, get_optional_user

router = APIRouter(prefix="/roadmap", tags=["roadmap"])


class SkillDone(BaseModel):
    model_config = ConfigDict(extra="forbid")

    done: StrictBool  # only true/false, not "yes" or 1


def _progress(db: Session, user_id: int, career_id: str) -> RoadmapProgress | None:
    return db.scalar(select(RoadmapProgress).where(
        RoadmapProgress.user_id == user_id, RoadmapProgress.career_id == career_id))


def _roadmap(db: Session, user: User | None, career_id: str) -> dict:
    catalog = get_catalog(db)
    if catalog.is_empty:
        raise REFERENCE_DATA_MISSING
    ctx = build_context(db, catalog, user.id if user else None)
    row = _progress(db, user.id, career_id) if user else None
    try:
        result = build_roadmap(catalog, ctx, career_id, set(row.completed_skill_ids) if row else set())
    except UnknownCareer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Career not found.") from None
    result["is_target"] = bool(row and row.is_target)
    result["logged_in"] = user is not None
    return result


def _catalog_career(db: Session, career_id: str):
    catalog = get_catalog(db)
    if career_id not in catalog.careers:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Career not found.")
    return catalog


@router.get("")
def my_target(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(RoadmapProgress).where(RoadmapProgress.user_id == user.id, RoadmapProgress.is_target))
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You have not chosen a target career yet.")
    return _roadmap(db, user, row.career_id)


@router.get("/{career_id}")
def get_roadmap(career_id: str, user: User | None = Depends(get_optional_user), db: Session = Depends(get_db)):
    return _roadmap(db, user, career_id)


@router.put("/{career_id}/target")
def set_target(career_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _catalog_career(db, career_id)
    db.execute(update(RoadmapProgress).where(RoadmapProgress.user_id == user.id).values(is_target=False))
    row = _progress(db, user.id, career_id) or RoadmapProgress(user_id=user.id, career_id=career_id, completed_skill_ids=[])
    row.is_target = True
    db.add(row)
    db.commit()
    return _roadmap(db, user, career_id)


@router.put("/{career_id}/skills/{skill_id}")
def mark_skill(career_id: str, skill_id: str, body: SkillDone, user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    catalog = _catalog_career(db, career_id)
    if skill_id not in {l.skill_id for l in catalog.career_skills.get(career_id, [])}:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This skill is not part of this roadmap.")
    row = _progress(db, user.id, career_id) or RoadmapProgress(user_id=user.id, career_id=career_id, completed_skill_ids=[])
    done = set(row.completed_skill_ids or [])
    done.add(skill_id) if body.done else done.discard(skill_id)
    row.completed_skill_ids = sorted(done)  # new list object so SQLAlchemy saves the JSON change
    db.add(row)
    db.commit()
    return _roadmap(db, user, career_id)
