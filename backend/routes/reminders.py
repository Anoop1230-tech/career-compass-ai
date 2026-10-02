"""Follow exams, see what is coming up, download a calendar file (login required)."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from database import get_db
from engine.catalog_data import get_catalog
from engine.reminders import exam_events, ics, serialize
from models import ExamFollow, User
from services.auth import get_current_user

router = APIRouter(prefix="/reminders", tags=["reminders"])


class FollowIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: bool = True


def _follows(db: Session, user: User) -> list[ExamFollow]:
    return list(db.scalars(select(ExamFollow).where(ExamFollow.user_id == user.id).order_by(ExamFollow.id)))


def _events(db: Session, user: User, today: date) -> tuple[list[dict], list[dict]]:
    catalog = get_catalog(db)
    exams, events = [], []
    for f in _follows(db, user):
        exam = catalog.exams.get(f.exam_id)
        if exam is None:  # removed from the catalog since it was followed
            continue
        evs = exam_events(exam, catalog.exam_dates.get(exam.exam_id, []), today)
        exams.append({"exam_id": exam.exam_id, "name": exam.name, "official_url": exam.official_url,
                      "typical_month": exam.typical_month, "email": f.email, "has_exact_dates": any(e["exact"] for e in evs)})
        events += evs
    events.sort(key=lambda e: (e["start"], e["key"]))
    return exams, events


@router.get("")
def list_reminders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    exams, events = _events(db, user, date.today())
    return {"exams": exams, "events": [serialize(e) for e in events]}


@router.get("/calendar.ics")
def calendar_file(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()
    _, events = _events(db, user, today)
    return Response(ics(events, today), media_type="text/calendar; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="exam-dates.ics"', "Cache-Control": "no-store"})


@router.put("/{exam_id}")
def follow(exam_id: str, body: FollowIn | None = None, db: Session = Depends(get_db),
           user: User = Depends(get_current_user)):
    if exam_id not in get_catalog(db).exams:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found.")
    row = db.scalar(select(ExamFollow).where(ExamFollow.user_id == user.id, ExamFollow.exam_id == exam_id))
    if row is None:
        row = ExamFollow(user_id=user.id, exam_id=exam_id, reminded=[])
        db.add(row)
    row.email = True if body is None else body.email
    db.commit()
    return list_reminders(db, user)


@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
def unfollow(exam_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.execute(delete(ExamFollow).where(ExamFollow.user_id == user.id, ExamFollow.exam_id == exam_id))
    db.commit()
