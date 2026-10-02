"""Recommendation feedback: "did this fit you?" is saved per user and career, with a score snapshot."""
import pytest
from sqlalchemy import select

from catalog.seed import seed
from database import SessionLocal
from models import RecommendationFeedback, User

from .conftest import valid_profile

CAREER = "CAR_DATA_SCIENTIST"


@pytest.fixture
def user(make_user):
    with SessionLocal() as db:
        seed(db, force=True)
    client = make_user("fb@example.com")
    assert client.put("/api/profile", json=valid_profile()).status_code in (200, 201)
    return client


def put(client, verdict, reason=None, career=CAREER):
    body = {"verdict": verdict} | ({"reason": reason} if reason else {})
    return client.put(f"/api/recommendations/{career}/feedback", json=body)


def test_list_has_no_feedback_at_first(user):
    items = user.get("/api/recommendations").json()["items"]
    assert items and all(i["feedback"] is None for i in items)


def test_save_and_show_feedback_with_snapshot(user):
    r = put(user, "fits")
    assert r.status_code == 200
    assert r.json() == {"career_id": CAREER, "feedback": {"verdict": "fits", "reason": None}}
    detail = user.get(f"/api/recommendations/{CAREER}").json()
    assert detail["feedback"] == {"verdict": "fits", "reason": None}
    with SessionLocal() as db:
        row = db.scalar(select(RecommendationFeedback))
        assert row.rank == detail["rank"]
        assert row.score == round(detail["score"], 1)
        assert 0 <= row.confidence <= 100
    listed = next((i for i in user.get("/api/recommendations?limit=50").json()["items"] if i["career_id"] == CAREER), None)
    assert listed is None or listed["feedback"]["verdict"] == "fits"


def test_changing_the_answer_overwrites(user):
    put(user, "fits")
    r = put(user, "not_for_me", "not_interested")
    assert r.json()["feedback"] == {"verdict": "not_for_me", "reason": "not_interested"}
    with SessionLocal() as db:
        assert db.query(RecommendationFeedback).count() == 1


def test_reason_only_kept_for_not_for_me(user):
    assert put(user, "fits", "skills_mismatch").json()["feedback"]["reason"] is None


def test_my_feedback_list_and_delete(user):
    put(user, "fits")
    put(user, "not_for_me", "too_hard_to_reach", career="CAR_ACCOUNTANT")
    mine = user.get("/api/recommendations/feedback").json()["items"]
    assert {i["career_id"] for i in mine} == {CAREER, "CAR_ACCOUNTANT"}
    assert user.delete(f"/api/recommendations/{CAREER}/feedback").status_code == 204
    assert [i["career_id"] for i in user.get("/api/recommendations/feedback").json()["items"]] == ["CAR_ACCOUNTANT"]
    assert user.delete(f"/api/recommendations/{CAREER}/feedback").status_code == 204  # already gone: fine


@pytest.mark.parametrize("body", [
    {"verdict": "maybe"},
    {"verdict": "fits", "reason": "because"},
    {"verdict": "fits", "comment": "free text is not accepted"},
    {"verdict": True},
    {},
])
def test_invalid_feedback_rejected(user, body):
    assert user.put(f"/api/recommendations/{CAREER}/feedback", json=body).status_code == 422


def test_unknown_career_and_login_and_profile_required(user, client, make_user):
    assert put(user, "fits", career="CAR_NOPE").status_code == 404
    client.post("/api/auth/logout")
    assert put(client, "fits").status_code == 401
    assert client.get("/api/recommendations/feedback").status_code == 401
    other = make_user("noprofile@example.com")
    assert put(other, "fits").status_code == 404


def test_feedback_is_private_and_deleted_with_account(user, make_user):
    put(user, "fits")
    user.post("/api/auth/logout")
    other = make_user("other@example.com")
    assert other.get("/api/recommendations/feedback").json()["items"] == []
    with SessionLocal() as db:
        db.delete(db.scalar(select(User).where(User.email == "fb@example.com")))
        db.commit()
        assert db.query(RecommendationFeedback).count() == 0



def test_feedback_summary_by_rank_band(make_user):
    from ml.feedback import summarise

    make_user("a@example.com")
    with SessionLocal() as db:
        uid = db.scalar(select(User.id))
        db.add_all([
            RecommendationFeedback(user_id=uid, career_id="CAR_A", verdict="fits", rank=1),
            RecommendationFeedback(user_id=uid, career_id="CAR_B", verdict="not_for_me", rank=2, reason="not_interested"),
            RecommendationFeedback(user_id=uid, career_id="CAR_C", verdict="not_for_me", rank=12, reason="not_interested"),
        ])
        db.commit()
        s = summarise(db)
    assert s["answers"] == 3 and s["users"] == 1 and s["enough_data"] is False
    assert s["bands"][0] == {"band": "rank 1-3", "answers": 2, "fits_percent": 50.0}
    assert s["bands"][1]["fits_percent"] is None
    assert s["reasons"] == {"not_interested": 2}
