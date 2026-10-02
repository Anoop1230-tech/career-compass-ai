"""Compare 2–3 careers side by side. Works for visitors; a logged-in profile adds fit and readiness."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from engine.catalog_data import get_catalog
from engine.compare import MAX_CAREERS, MIN_CAREERS, UnknownCareer, compare
from engine.context import build_context
from models import User
from routes.next_steps import REFERENCE_DATA_MISSING
from services.auth import get_optional_user

router = APIRouter(prefix="/compare", tags=["compare"])


@router.get("")
def compare_careers(
    ids: str = Query(max_length=200, description="2 or 3 career ids, comma separated"),
    stage: str | None = Query(default=None, max_length=40),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    career_ids = list(dict.fromkeys(i.strip() for i in ids.split(",") if i.strip()))
    if not MIN_CAREERS <= len(career_ids) <= MAX_CAREERS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Choose 2 or 3 different careers to compare.")
    catalog = get_catalog(db)
    if catalog.is_empty:
        raise REFERENCE_DATA_MISSING
    ctx = build_context(db, catalog, user.id if user else None)
    try:
        return compare(catalog, ctx, career_ids, stage)
    except UnknownCareer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Career not found.") from None
