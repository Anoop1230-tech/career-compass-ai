"""College predictor: compare a rank with last year's published closing ranks.

Bands (rank vs the final-round closing rank of the same seat type and gender):
  likely      rank <= 85% of the closing rank   (comfortably inside last year's cut-off)
  borderline  rank <= 110% of the closing rank  (near it; cut-offs move a little every year)
  unlikely    otherwise (only shown when asked)
Closing ranks change every year with seats and applicants, so this is a guide, never a promise.
Ranks for EWS, OBC-NCL, SC and ST seats are category ranks, as published by JoSAA."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from catalog.models import ClosingRank

LIKELY, BORDERLINE = 0.85, 1.10
EXAMS = {"EXM_JEE_MAIN", "EXM_JEE_ADVANCED"}
SEAT_TYPES = ("OPEN", "EWS", "OBC-NCL", "SC", "ST")


def band(rank: int, closing: int) -> str:
    if rank <= closing * LIKELY:
        return "likely"
    if rank <= closing * BORDERLINE:
        return "borderline"
    return "unlikely"


def predict(db: Session, *, exam_id: str, rank: int, seat_type: str = "OPEN", female: bool = False,
            stage_id: str | None = None, include_unlikely: bool = False, limit: int = 60) -> dict:
    query = select(ClosingRank).where(ClosingRank.exam_id == exam_id, ClosingRank.seat_type == seat_type)
    if stage_id:
        query = query.where(ClosingRank.stage_id == stage_id)
    rows = list(db.scalars(query))
    # One row per programme: the gender pools the candidate can use (female candidates can use both), most generous first
    best: dict[tuple, ClosingRank] = {}
    for r in rows:
        if r.gender == "female" and not female:
            continue
        key = (r.institute_name, r.stage_id)
        if key not in best or r.closing_rank > best[key].closing_rank:
            best[key] = r
    items = []
    for r in best.values():
        b = band(rank, r.closing_rank)
        if b == "unlikely" and not include_unlikely:
            continue
        items.append({"institute_name": r.institute_name, "institute_type": r.institute_type, "stage_id": r.stage_id,
                      "program_name": r.program_name, "quota": r.quota, "gender": r.gender,
                      "opening_rank": r.opening_rank, "closing_rank": r.closing_rank, "band": b})
    order = {"likely": 0, "borderline": 1, "unlikely": 2}
    # Most competitive first inside each band, so the best realistic options lead
    items.sort(key=lambda i: (order[i["band"]], i["closing_rank"]))
    meta = rows[0] if rows else None
    return {
        "counts": {k: sum(1 for i in items if i["band"] == k) for k in order},
        "total": len(items), "items": items[:limit],
        "source": {"year": meta.year, "round": meta.round, "url": meta.source_url,
                   "last_verified": meta.last_verified.isoformat()} if meta else None,
        "thresholds": {"likely": LIKELY, "borderline": BORDERLINE},
    }
