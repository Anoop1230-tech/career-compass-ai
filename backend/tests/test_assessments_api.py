"""Assessment API: questions without answers, shuffling, resume, scoring, privacy."""
import pytest
from fastapi.testclient import TestClient

from app import app
from catalog.models import AptitudeQuestion
from catalog.seed import seed
from database import SessionLocal


@pytest.fixture
def user(make_user):
    with SessionLocal() as db:
        seed(db, force=True)
    return make_user("tester@example.com")


def correct_shown_letters(start_body):
    """Work out, from the database, which SHOWN letter is correct for each question."""
    with SessionLocal() as db:
        correct = {q.question_id: q.options[q.correct_option] for q in db.query(AptitudeQuestion)}
    return {q["question_id"]: next(o["key"] for o in q["options"] if o["text"] == correct[q["question_id"]])
            for q in start_body["questions"]}


def test_everything_requires_login(client):
    for method, url in [("get", "/api/assessments"), ("post", "/api/assessments/interest/start"),
                        ("post", "/api/assessments/interest/submit"), ("get", "/api/assessments/results")]:
        assert getattr(client, method)(url).status_code == 401, url


def test_hub_lists_three_tests(user):
    items = {i["kind"]: i for i in user.get("/api/assessments").json()}
    assert set(items) == {"interest", "personality", "aptitude"}
    assert items["interest"]["question_count"] == 36
    assert items["aptitude"]["question_count"] == 40
    assert items["aptitude"]["completed_at"] is None and items["aptitude"]["in_progress"] is False


def test_unknown_kind_is_rejected(user):
    assert user.post("/api/assessments/astrology/start").status_code == 422


def test_aptitude_questions_never_include_answers(user):
    body = user.post("/api/assessments/aptitude/start").json()
    text = str(body)
    assert "correct_option" not in text and "explanation" not in text
    assert len(body["questions"]) == 40
    assert all([o["key"] for o in q["options"]] == ["a", "b", "c", "d"] for q in body["questions"])


def test_aptitude_is_shuffled_per_attempt(user):
    first = user.post("/api/assessments/aptitude/start").json()
    second = user.post("/api/assessments/aptitude/start?restart=true").json()
    assert first["attempt_id"] != second["attempt_id"]
    order_changed = [q["question_id"] for q in first["questions"]] != [q["question_id"] for q in second["questions"]]
    options_changed = any(a["options"] != b["options"] for a, b in zip(
        sorted(first["questions"], key=lambda q: q["question_id"]),
        sorted(second["questions"], key=lambda q: q["question_id"])))
    assert order_changed or options_changed
    # The correct answer is no longer mostly "b" as in the CSV
    letters = list(correct_shown_letters(second).values())
    assert letters.count("b") < 20


def test_refresh_resumes_same_attempt(user):
    first = user.post("/api/assessments/aptitude/start").json()
    again = user.post("/api/assessments/aptitude/start").json()
    assert again == first
    assert next(i for i in user.get("/api/assessments").json() if i["kind"] == "aptitude")["in_progress"] is True


def test_aptitude_full_score_uses_shuffled_letters(user):
    body = user.post("/api/assessments/aptitude/start").json()
    answers = correct_shown_letters(body)
    result = user.post("/api/assessments/aptitude/submit",
                       json={"attempt_id": body["attempt_id"], "answers": answers}).json()["result"]
    assert result["overall"] == 100 and result["correct"] == 40
    review = result["details"][0]
    assert review["explanation"] and review["text"] and len(review["options"]) == 4


def test_aptitude_skipped_and_wrong_answers(user):
    body = user.post("/api/assessments/aptitude/start").json()
    right = correct_shown_letters(body)
    ids = list(right)
    answers = {ids[0]: right[ids[0]], ids[1]: next(k for k in "abcd" if k != right[ids[1]]), ids[2]: None}
    result = user.post("/api/assessments/aptitude/submit",
                       json={"attempt_id": body["attempt_id"], "answers": answers}).json()["result"]
    assert result["correct"] == 1 and result["total"] == 40


def test_interest_and_personality_scores_are_saved(user):
    for kind, value in [("interest", 4), ("personality", 3)]:
        body = user.post(f"/api/assessments/{kind}/start").json()
        answers = {q["question_id"]: value for q in body["questions"]}
        response = user.post(f"/api/assessments/{kind}/submit", json={"attempt_id": body["attempt_id"], "answers": answers})
        assert response.status_code == 200, response.text
    results = user.get("/api/assessments/results").json()
    assert set(results) == {"interest", "personality"}
    assert len(results["interest"]["result"]["scales"]) == 6
    assert results["interest"]["result"]["top_code"] == "RIA"  # all equal -> fixed order
    assert results["personality"]["result"]["consistency_warning"] is False
    assert user.get("/api/assessments/interest/result").json()["kind"] == "interest"
    assert user.get("/api/assessments/aptitude/result").status_code == 404


@pytest.mark.parametrize(
    "kind,answers,message",
    [
        ("interest", {}, "not answered"),
        ("interest", {"IQ_R01": 9}, "not answered"),
        ("aptitude", {"AQ_FAKE": "a"}, "Unknown question"),
        ("aptitude", {"AQ_N01": "z"}, "a, b, c, d"),
    ],
)
def test_invalid_answers_are_rejected(user, kind, answers, message):
    body = user.post(f"/api/assessments/{kind}/start").json()
    response = user.post(f"/api/assessments/{kind}/submit", json={"attempt_id": body["attempt_id"], "answers": answers})
    assert response.status_code == 422
    assert message in response.json()["detail"]


def test_out_of_range_rating_rejected(user):
    body = user.post("/api/assessments/interest/start").json()
    answers = {q["question_id"]: 3 for q in body["questions"]}
    answers[body["questions"][0]["question_id"]] = 7
    response = user.post("/api/assessments/interest/submit", json={"attempt_id": body["attempt_id"], "answers": answers})
    assert response.status_code == 422 and "1 to 5" in response.json()["detail"]


def test_cannot_submit_twice_or_to_wrong_kind(user):
    body = user.post("/api/assessments/interest/start").json()
    answers = {q["question_id"]: 3 for q in body["questions"]}
    payload = {"attempt_id": body["attempt_id"], "answers": answers}
    assert user.post("/api/assessments/personality/submit", json=payload).status_code == 404
    assert user.post("/api/assessments/interest/submit", json=payload).status_code == 200
    assert user.post("/api/assessments/interest/submit", json=payload).status_code == 409
    # After submitting, "start" begins a fresh attempt
    assert user.post("/api/assessments/interest/start").json()["attempt_id"] != body["attempt_id"]


def test_users_cannot_use_or_see_each_others_tests(user):
    body = user.post("/api/assessments/interest/start").json()
    answers = {q["question_id"]: 5 for q in body["questions"]}
    user.post("/api/assessments/interest/submit", json={"attempt_id": body["attempt_id"], "answers": answers})
    other_attempt = user.post("/api/assessments/personality/start").json()["attempt_id"]

    with TestClient(app) as other:
        other.post("/api/auth/register", json={"email": "other@example.com", "password": "otherpass1"})
        assert other.get("/api/assessments/results").json() == {}
        stolen = other.post("/api/assessments/personality/submit", json={"attempt_id": other_attempt, "answers": {}})
        assert stolen.status_code == 404


def test_expired_attempt_is_rejected(user):
    from datetime import datetime, timedelta, timezone

    from models import AssessmentAttempt

    body = user.post("/api/assessments/interest/start").json()
    with SessionLocal() as db:
        attempt = db.get(AssessmentAttempt, body["attempt_id"])
        attempt.created_at = datetime.now(timezone.utc) - timedelta(hours=25)
        db.commit()
    answers = {q["question_id"]: 3 for q in body["questions"]}
    response = user.post("/api/assessments/interest/submit", json={"attempt_id": body["attempt_id"], "answers": answers})
    assert response.status_code == 410
    assert user.post("/api/assessments/interest/start").json()["attempt_id"] != body["attempt_id"]


def test_no_questions_loaded_gives_clear_error(make_user):
    client = make_user("empty@example.com")  # reference data not seeded
    response = client.post("/api/assessments/interest/start")
    assert response.status_code == 503
    assert "not loaded" in response.json()["detail"]



def test_duplicate_open_attempts_resolve_to_one(user):
    """Two start requests racing can create two rows; later starts must all
    resume the same (oldest) one, and a restart must clear the extras."""
    from models import AssessmentAttempt

    first = user.post("/api/assessments/aptitude/start").json()
    with SessionLocal() as db:  # simulate the race: a second open attempt appears
        original = db.get(AssessmentAttempt, first["attempt_id"])
        db.add(AssessmentAttempt(user_id=original.user_id, kind="aptitude",
                                 question_order=original.question_order, option_map=original.option_map))
        db.commit()
    assert user.post("/api/assessments/aptitude/start").json()["attempt_id"] == first["attempt_id"]

    fresh = user.post("/api/assessments/aptitude/start?restart=true").json()
    with SessionLocal() as db:
        open_rows = db.query(AssessmentAttempt).filter(
            AssessmentAttempt.kind == "aptitude", AssessmentAttempt.submitted_at.is_(None)).all()
    assert [a.id for a in open_rows] == [fresh["attempt_id"]]
