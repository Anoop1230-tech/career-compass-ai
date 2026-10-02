"""College predictor (visitors too): likely / borderline colleges from last year's published closing ranks."""
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from engine.predictor import predict

router = APIRouter(prefix="/predictor", tags=["predictor"])


@router.get("")
def predict_colleges(
    exam: Literal["EXM_JEE_MAIN", "EXM_JEE_ADVANCED"] = Query(description="Exam the rank is from"),
    rank: int = Query(ge=1, le=2_000_000, description="Common rank list (OPEN) or category rank"),
    seat_type: Literal["OPEN", "EWS", "OBC-NCL", "SC", "ST"] = "OPEN",
    female: bool = False,
    program: Literal["EDU_BTECH_CSE", "EDU_BTECH_ECE", "EDU_BTECH_MECH"] | None = None,
    include_unlikely: bool = False,
    db: Session = Depends(get_db),
):
    return predict(db, exam_id=exam, rank=rank, seat_type=seat_type, female=female, stage_id=program,
                   include_unlikely=include_unlikely)
