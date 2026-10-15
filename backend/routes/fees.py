"""Costs and help: official fee figures for a study path, plus the scholarships open to that stage.

Only fees copied from an institute's own fee notice are shown (datasets/fee_examples.csv, each
with its source and date). Nothing is estimated: where we have no official figure we say so and
point to the scholarships and fee waivers instead."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from catalog.models import FeeExample, Scholarship
from database import get_db
from engine.catalog_data import get_catalog
from models import User
from routes.next_steps import REFERENCE_DATA_MISSING
from routes.resources import PROVIDER_LABELS, _stage
from services.auth import get_optional_user

router = APIRouter(prefix="/fees", tags=["fees"])

Band = Literal["income_above_5l", "income_1_to_5l", "income_below_1l", "sc_st_pwd"]
PERIOD_ORDER = {"first_semester": 0, "first_year": 1, "per_year": 2, "programme_total": 3}


def _fee(f: FeeExample) -> dict:
    return {"fee_id": f.fee_id, "institution": f.institution, "institute_type": f.institute_type, "band": f.band,
            "period": f.period, "amount": f.amount, "includes_note": f.includes_note, "excludes_note": f.excludes_note,
            "waiver_note": f.waiver_note, "source_name": f.source_name, "source_url": f.source_url,
            "as_of": f.as_of.isoformat(), "last_verified": f.last_verified.isoformat()}


@router.get("")
def fees(
    stage: str | None = Query(default=None, max_length=40, description="Stage you want to study, e.g. EDU_BTECH_CIVIL"),
    band: Band | None = Query(default=None, description="Family income band or category, to show what you would pay"),
    for_me: bool = False,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    catalog = get_catalog(db)
    if catalog.is_empty:
        raise REFERENCE_DATA_MISSING
    stage, note = _stage(stage, for_me, user, db)
    if stage is not None and stage not in catalog.stages:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown stage.")

    rows = [f for f in db.scalars(select(FeeExample)) if stage is None or stage in f.stage_ids]
    rows.sort(key=lambda f: (f.institution, PERIOD_ORDER.get(f.period, 9), f.amount))
    fees_out = [_fee(f) for f in rows if band is None or f.band in (band, "all")]

    scholarships = [
        {"scholarship_id": s.scholarship_id, "name": s.name, "provider": s.provider,
         "provider_label": PROVIDER_LABELS.get(s.provider_type, s.provider_type),
         "eligibility_summary": s.eligibility_summary, "income_limit_note": s.income_limit_note,
         "category_note": s.category_note, "gender_note": s.gender_note, "amount_note": s.amount_note,
         "official_url": s.official_url}
        for s in db.scalars(select(Scholarship).order_by(Scholarship.name))
        if stage is not None and stage in s.eligible_stage_ids
    ]
    return {
        "stage": None if stage is None else {"stage_id": stage, "name": catalog.stages[stage].name},
        "note": note,
        "band": band,
        "fees": fees_out,
        "has_official_fees": bool(rows),
        "scholarships": scholarships,
    }
