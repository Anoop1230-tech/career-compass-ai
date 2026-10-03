"""Propose scoring-weight changes from real "does this fit you?" answers. Report only, never applied.

Run from the backend folder:
    python -m ml.tune_weights            # readable report
    python -m ml.tune_weights --json     # machine-readable

How it works
1. For every saved answer, the six signal scores (interest, skills, education, aptitude, personality,
   preferences; each 0-100) are recomputed for that user and career from the user's CURRENT profile and
   test results. Answers whose user has no profile any more are skipped.
2. Quality of a set of weights = pairwise AUC: the chance that a random "fits" answer scores higher than a
   random "not for me" answer (0.5 = no better than chance, 1.0 = perfect).
3. A bounded coordinate search moves 2 points at a time from one weight to another (sum stays 100, each
   weight stays within ±50% of its current value and at least 4). A move is kept if it improves AUC, or
   keeps AUC and widens the gap between the average "fits" and "not for me" scores.
4. Nothing is proposed below MIN_ANSWERS answers, or when either answer type is missing, or when the gain
   is smaller than MIN_GAIN (too small to tell apart from noise).

Reads only feedback rows plus the profile/test data the engine already uses; prints no names or emails.
To adopt a proposal, a person edits WEIGHTS in engine/recommend.py and reviews the change like any other.
"""
import argparse
import json
import sys
from itertools import permutations

from sqlalchemy import select
from sqlalchemy.orm import Session

from engine.catalog_data import get_catalog
from engine.context import build_context
from engine.recommend import WEIGHTS, reachable_careers, score_career
from models import RecommendationFeedback

MIN_ANSWERS = 30
MIN_GAIN = 0.02  # AUC points
STEP = 2
MAX_ROUNDS = 200


def collect(db: Session) -> list[dict]:
    """One sample per answer: signal scores (None when the signal is unavailable) and the label."""
    catalog = get_catalog(db)
    rows = db.scalars(select(RecommendationFeedback).order_by(RecommendationFeedback.id)).all()
    contexts, samples = {}, []
    for r in rows:
        career = catalog.careers.get(r.career_id)
        if career is None or r.verdict not in ("fits", "not_for_me"):
            continue
        if r.user_id not in contexts:
            ctx = build_context(db, catalog, r.user_id)
            contexts[r.user_id] = (ctx, reachable_careers(catalog, ctx.stage.stage_id)) if ctx.has_profile else None
        if contexts[r.user_id] is None:
            continue
        ctx, reach = contexts[r.user_id]
        item = score_career(catalog, ctx, career, reach)
        signals = {c["key"]: c["score"] for c in item["components"]}
        samples.append({"signals": signals, "fits": r.verdict == "fits"})
    return samples


def score(signals: dict, weights: dict) -> float:
    have = {k: v for k, v in signals.items() if v is not None and k in weights}
    total = sum(weights[k] for k in have)
    return sum(v * weights[k] for k, v in have.items()) / total if total else 0.0


def auc(samples: list[dict], weights: dict) -> float | None:
    pos = [score(s["signals"], weights) for s in samples if s["fits"]]
    neg = [score(s["signals"], weights) for s in samples if not s["fits"]]
    if not pos or not neg:
        return None
    wins = sum(1.0 if p > n else 0.5 if p == n else 0.0 for p in pos for n in neg)
    return wins / (len(pos) * len(neg))


def bounds(base: dict) -> dict:
    return {k: (max(4, round(v * 0.5)), round(v * 1.5)) for k, v in base.items()}


def gap(samples: list[dict], weights: dict) -> float:
    """Mean score of "fits" minus mean score of "not for me" (tie-breaker when AUC does not move)."""
    pos = [score(s["signals"], weights) for s in samples if s["fits"]]
    neg = [score(s["signals"], weights) for s in samples if not s["fits"]]
    return (sum(pos) / len(pos) - sum(neg) / len(neg)) if pos and neg else 0.0


def search(samples: list[dict], base: dict) -> tuple[dict, float]:
    """Greedy bounded search. Objective: AUC first, then the mean-score gap, so moves along an AUC
    plateau in the right direction are still taken. Returns the weights and their AUC."""
    limits = bounds(base)

    def objective(w: dict) -> tuple[float, float]:
        return round(auc(samples, w) or 0.0, 9), gap(samples, w)

    weights, best = dict(base), objective(base)
    for _ in range(MAX_ROUNDS):
        move = None
        for up, down in permutations(weights, 2):
            if weights[up] + STEP > limits[up][1] or weights[down] - STEP < limits[down][0]:
                continue
            trial = {**weights, up: weights[up] + STEP, down: weights[down] - STEP}
            value = objective(trial)
            if value > best and (move is None or value > move[1]):
                move = (trial, value)
        if move is None:
            break
        weights, best = move
    return weights, best[0]


def propose(db: Session, base: dict | None = None) -> dict:
    base = dict(base or WEIGHTS)
    samples = collect(db)
    fits = sum(s["fits"] for s in samples)
    report = {"answers_used": len(samples), "fits": fits, "not_for_me": len(samples) - fits,
              "min_answers": MIN_ANSWERS, "current": base, "current_auc": None, "proposed": None,
              "proposed_auc": None, "status": ""}
    if len(samples) < MIN_ANSWERS:
        report["status"] = "not_enough_data"
        return report
    current = auc(samples, base)
    report["current_auc"] = None if current is None else round(current, 3)
    if current is None:
        report["status"] = "one_sided"  # only "fits" or only "not for me": nothing to separate
        return report
    weights, best = search(samples, base)
    if best - current < MIN_GAIN:
        report["status"] = "keep_current"
        return report
    report.update(status="change_suggested", proposed=weights, proposed_auc=round(best, 3),
                  changes={k: weights[k] - base[k] for k in base if weights[k] != base[k]})
    return report


def render(r: dict) -> str:
    lines = [f"{r['answers_used']} answers used ({r['fits']} fits, {r['not_for_me']} not for me)."]
    if r["status"] == "not_enough_data":
        lines.append(f"Fewer than {r['min_answers']} answers: no proposal. Keep the current weights.")
    elif r["status"] == "one_sided":
        lines.append("All answers are of one kind, so the weights cannot be compared. Keep the current weights.")
    elif r["status"] == "keep_current":
        lines.append(f"Current weights separate the answers with AUC {r['current_auc']}; no change improves it by "
                     f"{MIN_GAIN} or more. Keep the current weights.")
    else:
        lines.append(f"AUC {r['current_auc']} -> {r['proposed_auc']} with these weights (review before adopting):")
        for k, v in r["proposed"].items():
            delta = v - r["current"][k]
            lines.append(f"  {k:12} {r['current'][k]:>3} -> {v:>3}" + (f"  ({delta:+d})" if delta else ""))
        lines.append("To adopt: edit WEIGHTS in engine/recommend.py, run the tests and ml.evaluate, and review.")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Propose scoring weights from user feedback (report only).")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    from database import SessionLocal

    with SessionLocal() as db:
        report = propose(db)
    print(json.dumps(report, indent=2) if args.json else render(report))
    return 0


if __name__ == "__main__":
    sys.exit(main())
