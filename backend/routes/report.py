"""My career report: one page for printing or "Save as PDF" in the browser (login required)."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from engine.catalog_data import get_catalog
from engine.context import build_context
from engine.report import build_report
from models import RoadmapProgress, User
from routes.next_steps import REFERENCE_DATA_MISSING
from services.auth import get_current_user

router = APIRouter(prefix="/report", tags=["report"])


@router.get("")
def my_report(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    catalog = get_catalog(db)
    if catalog.is_empty:
        raise REFERENCE_DATA_MISSING
    ctx = build_context(db, catalog, user.id)
    row = db.scalar(select(RoadmapProgress).where(RoadmapProgress.user_id == user.id, RoadmapProgress.is_target))
    target = None
    if row and row.career_id in catalog.careers:
        target = {"career_id": row.career_id, "done": set(row.completed_skill_ids or []),
                  "done_steps": set(row.completed_project_steps or [])}
    report = build_report(catalog, ctx, user.profile, target)
    report["email"] = user.email
    return report
