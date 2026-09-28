"""Next Step Engine API. Works for visitors (pick a stage) and gets
personalised when logged in (stage, skills and goals come from the profile)."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from engine.catalog_data import get_catalog
from engine.context import build_context
from engine.next_steps import UnknownStage, next_steps
from models import User
from services.auth import get_optional_user

router = APIRouter(prefix="/next-steps", tags=["next-steps"])

REFERENCE_DATA_MISSING = HTTPException(
    status.HTTP_503_SERVICE_UNAVAILABLE, "Reference data is not loaded yet. Run: python -m catalog.seed"
)


@router.get("")
def get_next_steps(
    stage: str | None = Query(default=None, max_length=40, description="Catalog stage id, e.g. EDU_BTECH_CSE"),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    catalog = get_catalog(db)
    if catalog.is_empty:
        raise REFERENCE_DATA_MISSING
    ctx = build_context(db, catalog, user.id if user else None)

    source = "query"
    stage_id = stage
    if stage_id is None:
        stage_id, source = ctx.stage.stage_id, "profile"
    context = {
        "logged_in": user is not None,
        "has_profile": ctx.has_profile,
        "source": source if stage_id else "none",
        "profile_stage_id": ctx.stage.stage_id,
        "stage_note": ctx.stage.note if ctx.has_profile else None,
        "stage_exact": ctx.stage.exact,
        "assessments_taken": ctx.assessments_taken,
    }
    if stage_id is None:
        return {"context": context, "result": None}
    try:
        result = next_steps(catalog, stage_id, ctx)
    except UnknownStage:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown stage.") from None
    return {"context": context, "result": result}
