"""Assessment API: start a test, submit answers, read results.

Security rules:
- Everything requires login; users only see their own attempts and results.
- Aptitude answers and explanations are never sent before submission.
- Aptitude options are shuffled per attempt; the server keeps the mapping.
"""
import random
from dataclasses import asdict, is_dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from catalog.models import AptitudeQuestion, InterestQuestion, PersonalityQuestion
from database import get_db
from models import AssessmentAttempt, AssessmentResult, User
from services.auth import get_current_user
from services.scoring import ScoringError, score_aptitude, score_interest, score_personality

router = APIRouter(prefix="/assessments", tags=["assessments"])

Kind = Literal["interest", "personality", "aptitude"]
ATTEMPT_TTL = timedelta(hours=24)  # an unfinished test can be resumed for a day

KINDS = {
    "interest": {
        "title": "Interest profile",
        "description": "Which kinds of work you enjoy, using the RIASEC model.",
        "minutes": 5,
        "model": InterestQuestion,
        "scale": "like",
    },
    "personality": {
        "title": "Personality and work style",
        "description": "How you usually think, feel and work with others.",
        "minutes": 5,
        "model": PersonalityQuestion,
        "scale": "agree",
    },
    "aptitude": {
        "title": "Aptitude quiz",
        "description": "Numerical, logical, verbal, spatial and problem-solving questions.",
        "minutes": 25,
        "model": AptitudeQuestion,
        "scale": "choice",
    },
}


class SubmitRequest(BaseModel):
    attempt_id: int
    answers: dict[str, int | str | None] = Field(max_length=500)


def _utc(value: datetime) -> datetime:
    # SQLite returns naive datetimes; treat them as UTC
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _load_questions(db: Session, kind: str) -> list:
    model = KINDS[kind]["model"]
    questions = db.scalars(select(model).order_by(model.question_id)).all()
    if not questions:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Questions are not loaded yet. Please try again shortly.")
    return list(questions)


def _latest_result(db: Session, user_id: int, kind: str) -> AssessmentResult | None:
    return db.scalar(
        select(AssessmentResult)
        .where(AssessmentResult.user_id == user_id, AssessmentResult.kind == kind)
        .order_by(AssessmentResult.created_at.desc(), AssessmentResult.id.desc())
        .limit(1)
    )


def _open_attempt(db: Session, user_id: int, kind: str) -> AssessmentAttempt | None:
    # The OLDEST open attempt wins: if two start requests race, both clients
    # end up resuming the same attempt instead of each getting a new one.
    attempt = db.scalar(
        select(AssessmentAttempt)
        .where(AssessmentAttempt.user_id == user_id, AssessmentAttempt.kind == kind,
               AssessmentAttempt.submitted_at.is_(None))
        .order_by(AssessmentAttempt.id.asc())
        .limit(1)
    )
    if attempt and datetime.now(timezone.utc) - _utc(attempt.created_at) < ATTEMPT_TTL:
        return attempt
    return None


def _to_plain(value):
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, list):
        return [_to_plain(v) for v in value]
    if isinstance(value, dict):
        return {k: _to_plain(v) for k, v in value.items()}
    return value


@router.get("")
def list_assessments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = []
    for kind, meta in KINDS.items():
        model = meta["model"]
        latest = _latest_result(db, user.id, kind)
        items.append({
            "kind": kind,
            "title": meta["title"],
            "description": meta["description"],
            "minutes": meta["minutes"],
            "question_count": db.query(model).count(),
            "completed_at": latest.created_at if latest else None,
            "in_progress": _open_attempt(db, user.id, kind) is not None,
        })
    return items


@router.post("/{kind}/start")
def start(kind: Kind, restart: bool = False, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns the questions for an attempt. Re-uses an unfinished attempt (same order)
    unless restart=true, so refreshing the page does not reshuffle the test."""
    questions = {q.question_id: q for q in _load_questions(db, kind)}
    attempt = None if restart else _open_attempt(db, user.id, kind)
    # A changed question bank invalidates the saved order
    if attempt and set(attempt.question_order) != set(questions):
        attempt = None

    if attempt is None:
        # Close any other open attempts (e.g. from two tabs or double requests),
        # so there is only ever one unfinished attempt per test.
        for old in db.scalars(select(AssessmentAttempt).where(
                AssessmentAttempt.user_id == user.id, AssessmentAttempt.kind == kind,
                AssessmentAttempt.submitted_at.is_(None))):
            db.delete(old)
        order = list(questions)
        option_map: dict = {}
        if kind == "aptitude":
            rng = random.SystemRandom()
            rng.shuffle(order)
            for qid in order:
                originals = ["a", "b", "c", "d"]
                rng.shuffle(originals)
                option_map[qid] = dict(zip("abcd", originals))  # shown letter -> original letter
        attempt = AssessmentAttempt(user_id=user.id, kind=kind, question_order=order, option_map=option_map)
        db.add(attempt)
        db.commit()
        db.refresh(attempt)

    items = []
    for qid in attempt.question_order:
        q = questions[qid]
        item = {"question_id": qid, "text": q.text}
        if kind == "aptitude":
            mapping = attempt.option_map[qid]
            item["category"] = q.category
            item["options"] = [{"key": shown, "text": q.options[mapping[shown]]} for shown in "abcd"]
        items.append(item)

    return {
        "attempt_id": attempt.id,
        "kind": kind,
        "title": KINDS[kind]["title"],
        "scale": KINDS[kind]["scale"],
        "questions": items,
    }


@router.post("/{kind}/submit")
def submit(kind: Kind, data: SubmitRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    attempt = db.get(AssessmentAttempt, data.attempt_id)
    # Same message for "not yours" and "does not exist": don't reveal other users' attempts
    if attempt is None or attempt.user_id != user.id or attempt.kind != kind:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This test session was not found. Please start again.")
    if attempt.submitted_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This test was already submitted.")
    if datetime.now(timezone.utc) - _utc(attempt.created_at) >= ATTEMPT_TTL:
        raise HTTPException(status.HTTP_410_GONE, "This test session has expired. Please start again.")

    questions = _load_questions(db, kind)
    try:
        if kind == "aptitude":
            answers = {}
            for qid, shown in data.answers.items():
                mapping = attempt.option_map.get(qid)
                if mapping is None:
                    raise ScoringError(f"Unknown question ids: ['{qid}']")
                if shown is not None and shown not in mapping:
                    raise ScoringError(f"Answer for {qid} must be a, b, c, d or empty")
                answers[qid] = mapping[shown] if shown is not None else None  # back to original letters
            result = score_aptitude(questions, answers)
        elif kind == "interest":
            result = score_interest(questions, data.answers)
        else:
            result = score_personality(questions, data.answers)
    except ScoringError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    plain = _to_plain(result)
    attempt.submitted_at = datetime.now(timezone.utc)
    record = AssessmentResult(user_id=user.id, kind=kind, result=plain)
    db.add(record)
    db.commit()
    db.refresh(record)
    return _result_out(db, record)


def _result_out(db: Session, record: AssessmentResult) -> dict:
    out = {"kind": record.kind, "created_at": record.created_at, "result": dict(record.result)}
    if record.kind == "aptitude":
        # After submission it's safe to show the correct answers and explanations
        by_id = {q.question_id: q for q in _load_questions(db, "aptitude")}
        review = []
        for d in record.result.get("details", []):
            q = by_id.get(d["question_id"])
            if q is None:
                continue
            review.append({
                **d,
                "text": q.text,
                "category": q.category,
                "options": [{"key": k, "text": q.options[k]} for k in "abcd"],
                "explanation": q.explanation,
            })
        out["result"]["details"] = review
    return out


@router.get("/results")
def all_results(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Latest result for each test the user has taken."""
    results = {}
    for kind in KINDS:
        latest = _latest_result(db, user.id, kind)
        if latest:
            results[kind] = _result_out(db, latest)
    return results


@router.get("/{kind}/result")
def latest_result(kind: Kind, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    latest = _latest_result(db, user.id, kind)
    if latest is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You have not taken this test yet.")
    return _result_out(db, latest)
