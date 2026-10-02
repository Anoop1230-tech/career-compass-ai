"""How well do recommendations match what users say? (real feedback, not synthetic personas)

Run from the backend folder:
    python -m ml.feedback
Reads only the recommendation_feedback table (career ids, answers, score/rank
snapshots); no names, emails or profiles. Prints the share of "fits" answers
per rank band. If the engine ranks well, higher-ranked careers get more "fits".
"""
import sys
from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import RecommendationFeedback

BANDS = [(1, 3, "rank 1-3"), (4, 10, "rank 4-10"), (11, 10_000, "rank 11+")]
MIN_ANSWERS = 30  # below this, percentages are too noisy to act on


def summarise(db: Session) -> dict:
    rows = db.scalars(select(RecommendationFeedback)).all()
    bands = []
    for low, high, label in BANDS:
        band = [r for r in rows if r.rank is not None and low <= r.rank <= high]
        fits = sum(r.verdict == "fits" for r in band)
        bands.append({"band": label, "answers": len(band),
                      "fits_percent": round(fits / len(band) * 100, 1) if band else None})
    reasons = Counter(r.reason for r in rows if r.verdict == "not_for_me" and r.reason)
    return {"answers": len(rows), "users": len({r.user_id for r in rows}), "bands": bands,
            "reasons": dict(reasons.most_common()), "enough_data": len(rows) >= MIN_ANSWERS}


def main() -> int:
    from database import SessionLocal

    with SessionLocal() as db:
        s = summarise(db)
    print(f"{s['answers']} answers from {s['users']} users")
    for b in s["bands"]:
        pct = "-" if b["fits_percent"] is None else f"{b['fits_percent']}% fit"
        print(f"  {b['band']:10} {b['answers']:>5} answers  {pct}")
    for reason, count in s["reasons"].items():
        print(f"  not for me because {reason}: {count}")
    if not s["enough_data"]:
        print(f"\nFewer than {MIN_ANSWERS} answers: too little to draw conclusions yet.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
