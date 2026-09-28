"""Skill gap for one target career (login + profile required)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from engine.skill_gap import UnknownCareer, skill_gap
from models import User
from routes.recommendations import _load
from services.auth import get_current_user

router = APIRouter(prefix="/skill-gap", tags=["skill-gap"])


@router.get("/{career_id}")
def get_skill_gap(career_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    catalog, ctx = _load(db, user)
    try:
        return skill_gap(catalog, ctx, career_id)
    except UnknownCareer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Career not found.") from None