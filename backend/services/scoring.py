"""Scoring for the three assessments. Pure functions: no database, no web.

All scores are on a 0-100 scale so they can be compared and later used by
the recommendation engine. They describe self-reported preferences and a
short quiz result; they are NOT clinical or psychometric diagnoses.

Answers:
- interest / personality: {question_id: 1..5}   (1 = strongly disagree/dislike, 5 = strongly agree/like)
- aptitude:               {question_id: "a".."d" or None}  (None = skipped)
"""
from collections import defaultdict
from dataclasses import dataclass

RIASEC_ORDER = ["R", "I", "A", "S", "E", "C"]  # fixed order breaks ties
RIASEC_NAMES = {
    "R": "Realistic", "I": "Investigative", "A": "Artistic",
    "S": "Social", "E": "Enterprising", "C": "Conventional",
}
LIKERT_MIN, LIKERT_MAX = 1, 5


class ScoringError(ValueError):
    """The answers do not match the questions (missing, unknown or invalid)."""


@dataclass(frozen=True)
class ScaleScore:
    key: str
    score: float  # 0-100
    band: str  # "low" | "moderate" | "high"
    answered: int


def band(score: float) -> str:
    if score < 40:
        return "low"
    if score <= 60:
        return "moderate"
    return "high"


def likert_to_100(mean: float) -> float:
    """1 -> 0, 3 -> 50, 5 -> 100."""
    return round((mean - LIKERT_MIN) / (LIKERT_MAX - LIKERT_MIN) * 100, 1)


def _check_likert(questions, answers: dict) -> None:
    ids = {q.question_id for q in questions}
    unknown = set(answers) - ids
    if unknown:
        raise ScoringError(f"Unknown question ids: {sorted(unknown)[:5]}")
    missing = ids - set(answers)
    if missing:
        raise ScoringError(f"{len(missing)} question(s) not answered")
    for qid, value in answers.items():
        # bool is a subclass of int in Python; reject it explicitly
        if isinstance(value, bool) or not isinstance(value, int) or not LIKERT_MIN <= value <= LIKERT_MAX:
            raise ScoringError(f"Answer for {qid} must be a whole number from 1 to 5")


def _scale_scores(groups: dict[str, list[int]], order: list[str]) -> list[ScaleScore]:
    result = []
    for key in order:
        values = groups.get(key, [])
        if not values:
            continue
        score = likert_to_100(sum(values) / len(values))
        result.append(ScaleScore(key=key, score=score, band=band(score), answered=len(values)))
    return result


def score_interest(questions, answers: dict) -> dict:
    """RIASEC interest profile. questions need .question_id and .riasec_type."""
    _check_likert(questions, answers)
    groups: dict[str, list[int]] = defaultdict(list)
    for q in questions:
        groups[q.riasec_type].append(answers[q.question_id])
    scales = _scale_scores(groups, RIASEC_ORDER)
    ranked = sorted(scales, key=lambda s: (-s.score, RIASEC_ORDER.index(s.key)))
    top = ranked[:3]
    return {
        "scales": scales,
        "top_code": "".join(s.key for s in top),  # e.g. "ICR" (Holland code)
        "top_types": [RIASEC_NAMES[s.key] for s in top],
        # All answers the same (e.g. all 3s) gives no real preference
        "undifferentiated": max(s.score for s in scales) - min(s.score for s in scales) < 10,
    }


def score_personality(questions, answers: dict) -> dict:
    """Big Five + work-style traits. questions need .question_id, .trait and .keyed ('+' or '-')."""
    _check_likert(questions, answers)
    groups: dict[str, list[int]] = defaultdict(list)
    order: list[str] = []
    for q in questions:
        if q.trait not in groups:
            order.append(q.trait)
        value = answers[q.question_id]
        # Reverse-keyed: agreeing with "I don't talk a lot" means LOW extraversion
        groups[q.trait].append(LIKERT_MAX + LIKERT_MIN - value if q.keyed == "-" else value)
    # Agreeing with everything (including reversed items) is a sign of careless answering
    raw = list(answers.values())
    acquiescence = sum(raw) / len(raw) >= 4.5 or sum(raw) / len(raw) <= 1.5
    return {"scales": _scale_scores(groups, order), "consistency_warning": acquiescence}


def score_aptitude(questions, answers: dict) -> dict:
    """Quiz score per category. questions need .question_id, .category, .correct_option.
    Answers use the ORIGINAL option letters (the API maps shuffled letters back)."""
    ids = {q.question_id for q in questions}
    unknown = set(answers) - ids
    if unknown:
        raise ScoringError(f"Unknown question ids: {sorted(unknown)[:5]}")
    for qid, value in answers.items():
        if value is not None and value not in ("a", "b", "c", "d"):
            raise ScoringError(f"Answer for {qid} must be a, b, c, d or empty")

    per_category: dict[str, dict] = {}
    details = []
    for q in questions:
        chosen = answers.get(q.question_id)
        correct = chosen == q.correct_option
        stats = per_category.setdefault(q.category, {"correct": 0, "total": 0, "skipped": 0})
        stats["total"] += 1
        stats["correct"] += int(correct)
        stats["skipped"] += int(chosen is None)
        details.append({"question_id": q.question_id, "chosen": chosen, "correct_option": q.correct_option,
                        "is_correct": correct})

    scales = []
    for category, stats in per_category.items():
        score = round(stats["correct"] / stats["total"] * 100, 1)
        scales.append({"key": category, "score": score, "band": band(score), **stats})
    total = sum(s["total"] for s in scales)
    correct = sum(s["correct"] for s in scales)
    return {
        "scales": scales,
        "overall": round(correct / total * 100, 1) if total else 0.0,
        "correct": correct,
        "total": total,
        "details": details,
    }
