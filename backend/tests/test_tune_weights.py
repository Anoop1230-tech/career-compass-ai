"""Phase 30: weight proposals from "does this fit you?" answers (report only)."""
import pytest

from catalog.seed import seed
from database import SessionLocal
from engine.recommend import WEIGHTS
from ml import tune_weights as tw
from tests.conftest import valid_profile


def sample(fits, **signals):
    base = {k: 50.0 for k in WEIGHTS}
    return {"signals": {**base, **signals}, "fits": fits}


def test_auc():
    s = [sample(True, interest=90), sample(False, interest=10)]
    assert tw.auc(s, WEIGHTS) == 1.0
    assert tw.auc([sample(True)], WEIGHTS) is None


def test_missing_signals_are_left_out_of_the_score():
    s = sample(True, interest=80)
    s["signals"]["skills"] = None
    assert tw.score(s["signals"], {"interest": 50, "skills": 50, **{k: 0 for k in WEIGHTS if k not in ("interest", "skills")}}) == 80


def test_search_moves_weight_to_the_signal_that_explains_answers_and_respects_bounds():
    # Interest separates the answers; skills point the wrong way
    samples = [sample(True, interest=80 + i % 5, skills=30) for i in range(20)] + \
              [sample(False, interest=40 + i % 5, skills=90) for i in range(20)]
    weights, best = tw.search(samples, WEIGHTS)
    assert sum(weights.values()) == 100
    assert weights["interest"] > WEIGHTS["interest"] and weights["skills"] < WEIGHTS["skills"]
    limits = tw.bounds(WEIGHTS)
    assert all(limits[k][0] <= v <= limits[k][1] for k, v in weights.items())
    assert best >= tw.auc(samples, WEIGHTS)


@pytest.fixture
def db_with_users(client, make_user):
    with SessionLocal() as db:
        seed(db, force=True)

    def add_answers(n_users, verdicts):
        for i in range(n_users):
            c = make_user(email=f"tune{i}@example.com")
            c.put("/api/profile", json=valid_profile())
            items = c.get("/api/recommendations", params={"limit": len(verdicts)}).json()["items"]
            for item, verdict in zip(items, verdicts):
                body = {"verdict": verdict, **({"reason": "not_interested"} if verdict == "not_for_me" else {})}
                assert c.put(f"/api/recommendations/{item['career_id']}/feedback", json=body).status_code == 200
            c.post("/api/auth/logout")
    return add_answers


def test_not_enough_data(db_with_users):
    db_with_users(2, ["fits", "not_for_me", "fits"])
    with SessionLocal() as db:
        r = tw.propose(db)
    assert r["answers_used"] == 6 and r["status"] == "not_enough_data" and r["proposed"] is None
    assert "Keep the current weights" in tw.render(r)


def test_enough_data_gives_a_reviewed_report_and_never_changes_weights(db_with_users):
    before = dict(WEIGHTS)
    db_with_users(4, ["fits", "fits", "fits", "not_for_me", "not_for_me", "fits", "not_for_me", "not_for_me"])
    with SessionLocal() as db:
        r = tw.propose(db)
    assert r["answers_used"] >= tw.MIN_ANSWERS
    assert r["status"] in {"keep_current", "change_suggested", "one_sided"}
    if r["status"] == "change_suggested":
        assert sum(r["proposed"].values()) == 100 and r["proposed_auc"] - r["current_auc"] >= tw.MIN_GAIN
    assert WEIGHTS == before  # report only
    text = tw.render(r)
    assert "answers used" in text
