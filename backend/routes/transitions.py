"""Dream Career Checker: "I am X, can I become Y?" Works for visitors when
`from_stage` or `from_career` is given; otherwise uses the logged-in profile."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from engine.catalog_data import get_catalog
from engine.context import build_context
from engine.transitions import UnknownTarget, check_transition
from models import User
from routes.next_steps import REFERENCE_DATA_MISSING
from services.auth import get_optional_user

router = APIRouter(prefix="/transitions", tags=["transitions"])


@router.get("/check")
def check(
    to: str = Query(max_length=40, description="Target career id"),
    from_stage: str | None = Query(default=None, max_length=40),
    from_career: str | None = Query(default=None, max_length=40),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    catalog = get_catalog(db)
    if catalog.is_empty:
        raise REFERENCE_DATA_MISSING
    ctx = build_context(db, catalog, user.id if user else None)
    source = "query"
    if not from_stage and not from_career:
        from_stage, from_career, source = ctx.stage.stage_id, ctx.current_career_id, "profile"
        if not from_stage and not from_career:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                                "Tell us where you are now: choose a stage or a current career.")
    try:
        result = check_transition(catalog, ctx, to, from_stage=from_stage, from_career=from_career)
    except UnknownTarget as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown stage or career: {exc}") from None
    result["source"] = source
    result["personalised"] = ctx.has_profile
    return result