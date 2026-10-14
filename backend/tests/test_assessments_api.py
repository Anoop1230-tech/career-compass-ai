"""Assessment API: a single short interest test. Resume, scoring, privacy."""
import pytest
from fastapi.testclient import TestClient

from app import app
from catalog.seed import seed
from database import SessionLocal
from routes.assessments import INTEREST_QUESTION_COUNT


@pytest.fixture
def user(make_user):
    with SessionLocal() as db:
        seed(db, force=True)
    return make_user("tester@example.com")


def test_everything_requires_login(client):
    for method, url in [("get", "/api/assessments"), ("post", "/api/assessments/interest/start"),
                        ("post", "/api/assessments/interest/submit"), ("get", "/api/assessments/results")]:
        assert getattr(client, method)(url).status_code == 401, url


def test_hub_lists_only_the_interest_test(user):
    items = {i["kind"]: i for i in user.get("/api/assessments").json()}
    assert set(items) == {"interest"}
    assert items["interest"]["question_count"] == INTEREST_QUESTION_COUNT
    assert items["interest"]["completed_at"] is None and items["interest"]["in_progress"] is False


def test_removed_tests_are_rejected(user):
    # The personality and aptitude tests were retired; only "interest" is valid.
    assert user.post("/api/assessments/personality/start").status_code == 422
    assert user.post("/api/assessments/aptitude/start").status_code == 422
    assert user.post("/api/assessments/astrology/start").status_code == 422


def test_interest_test_is_short(user):
    body = user.post("/api/assessments/interest/start").json()
    assert len(body["questions"]) == INTEREST_QUESTION_COUNT
    assert body["scale"] == "like"
    # A short test still spreads across more than one RIASEC type
    with SessionLocal() as db:
        from catalog.models import InterestQuestion
        types = {db.get(InterestQuestion, q["question_id"]).riasec_type for q in body["questions"]}
    assert len(types) >= 4


def test_refresh_resumes_same_attempt(user):
    first = user.post("/api/assessments/interest/start").json()
    again = user.post("/api/assessments/interest/start").json()
    assert again == first
    assert next(i for i in user.get("/api/assessments").json() if i["kind"] == "interest")["in_progress"] is True


def test_interest_score_is_saved(user):
    body = user.post("/api/assessments/interest/start").json()
    answers = {q["question_id"]: 4 for q in body["questions"]}
    response = user.post("/api/assessments/interest/submit",
                         json={"attempt_id": body["attempt_id"], "answers": answers})
    assert response.status_code == 200, response.text
    results = user.get("/api/assessments/results").json()
    assert set(results) == {"interest"}
    assert results["interest"]["result"]["top_code"]  # a Holland code was produced
    assert user.get("/api/assessments/interest/result").json()["kind"] == "interest"
    assert user.get("/api/assessments/aptitude/result").status_code == 422


@pytest.mark.parametrize(
    "answers,message",
    [
        ({}, "not answered"),
        ({"IQ_R01": 9}, "not answered"),
    ],
)
def test_invalid_answers_are_rejected(user, answers, message):
    body = user.post("/api/assessments/interest/start").json()
    response = user.post("/api/assessments/interest/submit",
                         json={"attempt_id": body["attempt_id"], "answers": answers})
    assert response.status_code == 422
    assert message in response.json()["detail"]


def test_out_of_range_rating_rejected(user):
    body = user.post("/api/assessments/interest/start").json()
    answers = {q["question_id"]: 3 for q in body["questions"]}
    answers[body["questions"][0]["question_id"]] = 7
    response = user.post("/api/assessments/interest/submit",
                         json={"attempt_id": body["attempt_id"], "answers": answers})
    assert response.status_code == 422 and "1 to 5" in response.json()["detail"]


def test_cannot_submit_twice(user):
    body = user.post("/api/assessments/interest/start").json()
    answers = {q["question_id"]: 3 for q in body["questions"]}
    payload = {"attempt_id": body["attempt_id"], "answers": answers}
    assert user.post("/api/assessments/interest/submit", json=payload).status_code == 200
    assert user.post("/api/assessments/interest/submit", json=payload).status_code == 409
    # After submitting, "start" begins a fresh attempt
    assert user.post("/api/assessments/interest/start").json()["attempt_id"] != body["attempt_id"]


def test_users_cannot_use_or_see_each_others_tests(user):
    body = user.post("/api/assessments/interest/start").json()
    answers = {q["question_id"]: 5 for q in body["questions"]}
    user.post("/api/assessments/interest/submit", json={"attempt_id": body["attempt_id"], "answers": answers})
    mine = user.post("/api/assessments/interest/start?restart=true").json()["attempt_id"]

    with TestClient(app) as other:
        other.post("/api/auth/register", json={"email": "other@example.com", "password": "otherpass1"})
        assert other.get("/api/assessments/results").json() == {}
        stolen = other.post("/api/assessments/interest/submit", json={"attempt_id": mine, "answers": {}})
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
    response = user.post("/api/assessments/interest/submit",
                         json={"attempt_id": body["attempt_id"], "answers": answers})
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

    first = user.post("/api/assessments/interest/start").json()
    with SessionLocal() as db:  # simulate the race: a second open attempt appears
        original = db.get(AssessmentAttempt, first["attempt_id"])
        db.add(AssessmentAttempt(user_id=original.user_id, kind="interest",
                                 question_order=original.question_order, option_map=original.option_map))
        db.commit()
    assert user.post("/api/assessments/interest/start").json()["attempt_id"] == first["attempt_id"]

    fresh = user.post("/api/assessments/interest/start?restart=true").json()
    with SessionLocal() as db:
        open_rows = db.query(AssessmentAttempt).filter(
            AssessmentAttempt.kind == "interest", AssessmentAttempt.submitted_at.is_(None)).all()
    assert [a.id for a in open_rows] == [fresh["attempt_id"]]
