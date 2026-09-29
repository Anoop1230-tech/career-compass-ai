"""Exams, colleges, universities and scholarships: filterable lists with
official links and the date each entry was last checked.

`for_me=true` fills the stage filter from the logged-in user's profile."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from catalog.models import College, Exam, Scholarship, Stage, University
from database import get_db
from engine.catalog_data import get_catalog
from engine.context import build_context
from models import User
from services.auth import get_optional_user

router = APIRouter(prefix="/resources", tags=["resources"])

TYPE_LABELS = {
    "central": "Central university", "state": "State", "deemed": "Deemed university", "private": "Private",
    "institute_of_national_importance": "Institute of National Importance",
}
PROVIDER_LABELS = {"central_government": "Central government", "state_government": "State government",
                   "private": "Private", "university": "University", "international": "International"}


def _text(q: str | None, *values) -> bool:
    if not q:
        return True
    needle = q.strip().casefold()
    return any(needle in (v or "").casefold() for v in values)


def _stage(stage: str | None, for_me: bool, user: User | None, db: Session) -> tuple[str | None, str | None]:
    """(stage_id, note). Explicit ?stage= wins over the profile."""
    if stage or not for_me:
        return stage, None
    ctx = build_context(db, get_catalog(db), user.id if user else None)
    if not ctx.stage.stage_id:
        return None, "Log in and complete your profile to filter by your stage."
    return ctx.stage.stage_id, ctx.stage.note


def _exam_ref(exams: dict, ids: list[str]) -> list[dict]:
    return [{"exam_id": e.exam_id, "name": e.name, "official_url": e.official_url} for e in (exams.get(i) for i in ids) if e]


@router.get("/filters")
def filters(db: Session = Depends(get_db)):
    colleges = db.scalars(select(College)).all()
    unis = db.scalars(select(University)).all()
    return {
        "states": sorted({c.state for c in colleges} | {u.state for u in unis}),
        "institution_types": [{"value": k, "label": v} for k, v in TYPE_LABELS.items()],
        "provider_types": [{"value": k, "label": v} for k, v in PROVIDER_LABELS.items()],
        "exam_levels": sorted({e.exam_level for e in db.scalars(select(Exam))}),
    }


@router.get("/exams")
def exams(
    q: str | None = Query(default=None, max_length=60),
    level: str | None = Query(default=None, max_length=30),
    stage: str | None = Query(default=None, max_length=40),
    for_me: bool = False,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    stage, note = _stage(stage, for_me, user, db)
    stages = {s.stage_id: s.name for s in db.scalars(select(Stage))}
    items = [
        {"exam_id": e.exam_id, "name": e.name, "full_name": e.full_name, "conducting_body": e.conducting_body,
         "exam_level": e.exam_level, "purpose": e.purpose, "eligibility_summary": e.eligibility_summary,
         "eligible_stages": [stages.get(s, s) for s in e.eligible_stage_ids], "age_limit_note": e.age_limit_note,
         "frequency": e.frequency, "typical_month": e.typical_month, "official_url": e.official_url,
         "verified": e.verified, "last_verified": e.last_verified.isoformat()}
        for e in db.scalars(select(Exam).order_by(Exam.name))
        if (level is None or e.exam_level == level) and (stage is None or stage in e.eligible_stage_ids)
        and _text(q, e.name, e.full_name, e.purpose, e.conducting_body)
    ]
    return {"stage": stage, "note": note, "total": len(items), "items": items}


@router.get("/colleges")
def colleges(
    q: str | None = Query(default=None, max_length=60),
    state: str | None = Query(default=None, max_length=60),
    type: str | None = Query(default=None, max_length=40),
    exam: str | None = Query(default=None, max_length=40),
    stage: str | None = Query(default=None, max_length=40, description="Programme (stage) offered"),
    db: Session = Depends(get_db),
):
    exams_by_id = {e.exam_id: e for e in db.scalars(select(Exam))}
    stages = {s.stage_id: s.name for s in db.scalars(select(Stage))}
    unis = {u.university_id: u.name for u in db.scalars(select(University))}
    items = [
        {"college_id": c.college_id, "name": c.name, "university": unis.get(c.university_id), "type": c.type,
         "type_label": TYPE_LABELS.get(c.type, c.type), "state": c.state, "city": c.city,
         "programmes": [{"stage_id": s, "name": stages.get(s, s)} for s in c.stage_ids_offered],
         "exams": _exam_ref(exams_by_id, c.accepted_exam_ids), "nirf_rank": c.nirf_rank, "nirf_year": c.nirf_year,
         "fees_note": c.fees_note, "official_url": c.official_url, "last_verified": c.last_verified.isoformat()}
        for c in db.scalars(select(College).order_by(College.name))
        if (state is None or c.state == state) and (type is None or c.type == type)
        and (exam is None or exam in c.accepted_exam_ids) and (stage is None or stage in c.stage_ids_offered)
        and _text(q, c.name, c.city, c.state, unis.get(c.university_id))
    ]
    return {"total": len(items), "items": items}


@router.get("/universities")
def universities(
    q: str | None = Query(default=None, max_length=60),
    state: str | None = Query(default=None, max_length=60),
    type: str | None = Query(default=None, max_length=40),
    db: Session = Depends(get_db),
):
    items = [
        {"university_id": u.university_id, "name": u.name, "type": u.type, "type_label": TYPE_LABELS.get(u.type, u.type),
         "state": u.state, "city": u.city, "ugc_recognized": u.ugc_recognized, "nirf_rank": u.nirf_rank,
         "official_url": u.official_url, "last_verified": u.last_verified.isoformat()}
        for u in db.scalars(select(University).order_by(University.name))
        if (state is None or u.state == state) and (type is None or u.type == type) and _text(q, u.name, u.city, u.state)
    ]
    return {"total": len(items), "items": items}


@router.get("/scholarships")
def scholarships(
    q: str | None = Query(default=None, max_length=60),
    provider_type: str | None = Query(default=None, max_length=40),
    stage: str | None = Query(default=None, max_length=40),
    for_me: bool = False,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    stage, note = _stage(stage, for_me, user, db)
    items = [
        {"scholarship_id": s.scholarship_id, "name": s.name, "provider": s.provider, "provider_type": s.provider_type,
         "provider_label": PROVIDER_LABELS.get(s.provider_type, s.provider_type),
         "eligibility_summary": s.eligibility_summary, "income_limit_note": s.income_limit_note,
         "category_note": s.category_note, "gender_note": s.gender_note, "state_restriction": s.state_restriction,
         "amount_note": s.amount_note, "application_window_note": s.application_window_note,
         "official_url": s.official_url, "verified": s.verified, "last_verified": s.last_verified.isoformat()}
        for s in db.scalars(select(Scholarship).order_by(Scholarship.name))
        if (provider_type is None or s.provider_type == provider_type)
        and (stage is None or stage in s.eligible_stage_ids)
        and _text(q, s.name, s.provider, s.eligibility_summary, s.category_note)
    ]
    return {"stage": stage, "note": note, "total": len(items), "items": items}
