"""Upcoming exams: a public, no-login list of exam events coming up next.

Think of the Sarkari Result front page, but built only from our own verified
catalog: for every exam we show the next registration, admit-card, exam and
result dates (soonest first), each with the official link so the user can go
and apply. Dates are either exact (published by the organiser in
datasets/exam_dates.csv) or indicative (the usual month from the exam's
`typical_month`), and every row says which it is so nothing looks more certain
than it is."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from engine.catalog_data import get_catalog
from engine.reminders import EVENT_LABELS, exam_events, serialize
from routes.next_steps import REFERENCE_DATA_MISSING
from services.lang import Localizer, request_lang

router = APIRouter(prefix="/exams", tags=["exams"])

# Events that mean "you can act now" (apply or download the admit card),
# used to flag rows the user should look at first.
ACTION_EVENTS = {"registration_opens", "registration_closes", "late_registration_closes", "admit_card"}


@router.get("/upcoming")
def upcoming_exams(
    level: str | None = Query(default=None, max_length=30, description="Filter by exam_level, e.g. government_job"),
    scope: str | None = Query(default=None, max_length=20, description="Filter by administrative scope, e.g. state"),
    days: int | None = Query(default=None, ge=1, le=730, description="Only events within this many days from today"),
    limit: int = Query(default=100, ge=1, le=300),
    db: Session = Depends(get_db),
    lang: str = Depends(request_lang),
):
    """Upcoming exam events across the whole catalog, soonest first."""
    catalog = get_catalog(db)
    if catalog.is_empty:
        raise REFERENCE_DATA_MISSING

    tr = Localizer(db, lang)
    today = date.today()
    cutoff = None if days is None else today + timedelta(days=days)

    rows: list[dict] = []
    for exam in catalog.exams.values():
        if level is not None and exam.exam_level != level:
            continue
        if scope is not None and exam.exam_scope != scope:
            continue
        events = exam_events(exam, catalog.exam_dates.get(exam.exam_id, []), today)
        for ev in events:
            if cutoff is not None and ev["start"] > cutoff:
                continue
            rows.append({
                **serialize(ev),
                "label": EVENT_LABELS.get(ev["event"], ev["event"]),
                "exam_level": exam.exam_level,
                "exam_scope": exam.exam_scope,
                "conducting_body": exam.conducting_body,
                "official_url": exam.official_url,
                "purpose": tr("exam", exam.exam_id, "purpose", exam.purpose),
                "can_apply": ev["event"] in ACTION_EVENTS,
            })

    rows.sort(key=lambda r: (r["start"], not r["exact"], r["key"]))
    rows = rows[:limit]
    return {"today": today.isoformat(), "total": len(rows), "events": rows}
