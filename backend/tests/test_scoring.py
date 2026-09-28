"""Scoring rules, tested with small hand-made question sets."""
from types import SimpleNamespace as Q

import pytest

from services.scoring import (
    ScoringError,
    band,
    likert_to_100,
    score_aptitude,
    score_interest,
    score_personality,
)

INTEREST = [Q(question_id=f"{t}{i}", riasec_type=t) for t in "RIASEC" for i in (1, 2)]
PERSONALITY = [
    Q(question_id="E1", trait="extraversion", keyed="+"),
    Q(question_id="E2", trait="extraversion", keyed="-"),
    Q(question_id="L1", trait="leadership", keyed="+"),
    Q(question_id="L2", trait="leadership", keyed="-"),
]
APTITUDE = [
    Q(question_id="N1", category="numerical", correct_option="b"),
    Q(question_id="N2", category="numerical", correct_option="c"),
    Q(question_id="V1", category="verbal", correct_option="a"),
    Q(question_id="V2", category="verbal", correct_option="d"),
]


def all_interest(value):
    return {q.question_id: value for q in INTEREST}


def test_likert_scale_and_bands():
    assert likert_to_100(1) == 0
    assert likert_to_100(3) == 50
    assert likert_to_100(5) == 100
    assert band(39.9) == "low" and band(40) == "moderate" and band(60) == "moderate" and band(60.1) == "high"


def test_interest_ranks_types_and_builds_holland_code():
    answers = all_interest(2)
    answers.update({"I1": 5, "I2": 5, "C1": 4, "C2": 4, "R1": 4, "R2": 3})
    result = score_interest(INTEREST, answers)
    scores = {s.key: s.score for s in result["scales"]}
    assert scores["I"] == 100 and scores["C"] == 75 and scores["R"] == 62.5 and scores["A"] == 25
    assert result["top_code"] == "ICR"
    assert result["top_types"] == ["Investigative", "Conventional", "Realistic"]
    assert result["undifferentiated"] is False


def test_interest_ties_use_fixed_order_and_flat_answers_are_flagged():
    result = score_interest(INTEREST, all_interest(3))
    assert result["top_code"] == "RIA"
    assert result["undifferentiated"] is True


def test_personality_reverse_keyed_items():
    # "Life of the party" = 5 and "I don't talk a lot" = 1 -> both mean HIGH extraversion
    result = score_personality(PERSONALITY, {"E1": 5, "E2": 1, "L1": 1, "L2": 5})
    scores = {s.key: s for s in result["scales"]}
    assert scores["extraversion"].score == 100 and scores["extraversion"].band == "high"
    assert scores["leadership"].score == 0 and scores["leadership"].band == "low"
    assert [s.key for s in result["scales"]] == ["extraversion", "leadership"]  # question order kept


def test_agreeing_with_everything_gives_a_warning_and_middle_scores():
    result = score_personality(PERSONALITY, {q.question_id: 5 for q in PERSONALITY})
    assert result["consistency_warning"] is True
    assert all(s.score == 50 for s in result["scales"])  # reversed items cancel out
    normal = score_personality(PERSONALITY, {"E1": 4, "E2": 2, "L1": 3, "L2": 3})
    assert normal["consistency_warning"] is False


@pytest.mark.parametrize(
    "answers,message",
    [
        ({"E1": 5, "E2": 1, "L1": 1}, "not answered"),
        ({"E1": 5, "E2": 1, "L1": 1, "L2": 5, "X9": 3}, "Unknown question"),
        ({"E1": 6, "E2": 1, "L1": 1, "L2": 5}, "1 to 5"),
        ({"E1": 0, "E2": 1, "L1": 1, "L2": 5}, "1 to 5"),
        ({"E1": 2.5, "E2": 1, "L1": 1, "L2": 5}, "1 to 5"),
        ({"E1": "5", "E2": 1, "L1": 1, "L2": 5}, "1 to 5"),
        ({"E1": True, "E2": 1, "L1": 1, "L2": 5}, "1 to 5"),
    ],
)
def test_likert_answers_are_validated(answers, message):
    with pytest.raises(ScoringError, match=message):
        score_personality(PERSONALITY, answers)


def test_aptitude_scores_per_category_and_overall():
    result = score_aptitude(APTITUDE, {"N1": "b", "N2": "a", "V1": "a", "V2": None})
    cats = {s["key"]: s for s in result["scales"]}
    assert cats["numerical"]["score"] == 50 and cats["numerical"]["correct"] == 1
    assert cats["verbal"]["score"] == 50 and cats["verbal"]["skipped"] == 1
    assert result["overall"] == 50 and result["correct"] == 2 and result["total"] == 4
    wrong = next(d for d in result["details"] if d["question_id"] == "N2")
    assert wrong == {"question_id": "N2", "chosen": "a", "correct_option": "c", "is_correct": False}


def test_aptitude_unanswered_counts_as_wrong_and_perfect_score():
    assert score_aptitude(APTITUDE, {})["overall"] == 0
    perfect = score_aptitude(APTITUDE, {"N1": "b", "N2": "c", "V1": "a", "V2": "d"})
    assert perfect["overall"] == 100 and all(s["band"] == "high" for s in perfect["scales"])


@pytest.mark.parametrize("answers", [{"N1": "e"}, {"N1": "B"}, {"N1": 1}, {"ZZ": "a"}])
def test_aptitude_answers_are_validated(answers):
    with pytest.raises(ScoringError):
        score_aptitude(APTITUDE, answers)


def test_real_question_banks_score_without_errors():
    """The real CSV data must work with the scoring rules."""
    from catalog.validator import validate

    _, tables = validate()
    interest = [Q(question_id=r["question_id"], riasec_type=r["riasec_type"]) for r in tables["interest_questions.csv"]]
    personality = [Q(question_id=r["question_id"], trait=r["trait"], keyed=r["keyed"])
                   for r in tables["personality_questions.csv"]]
    aptitude = [Q(question_id=r["question_id"], category=r["category"], correct_option=r["correct_option"])
                for r in tables["aptitude_questions.csv"]]

    assert len(score_interest(interest, {q.question_id: 4 for q in interest})["scales"]) == 6
    assert len(score_personality(personality, {q.question_id: 3 for q in personality})["scales"]) == 10
    all_right = score_aptitude(aptitude, {q.question_id: q.correct_option for q in aptitude})
    assert all_right["overall"] == 100 and len(all_right["scales"]) == 5
