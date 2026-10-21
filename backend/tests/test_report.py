"""Phase 24: one-page career report."""
import pytest

from catalog.seed import seed
from database import SessionLocal
from tests.conftest import valid_profile


@pytest.fixture
def api(client):
    with SessionLocal() as db:
        seed(db, force=True)
    return client


def test_report_needs_login(api):
    assert api.get("/api/report").status_code == 401


def test_report_without_profile_is_mostly_empty(api, make_user):
    body = make_user().get("/api/report").json()
    assert body["profile"] is None and body["matches"] == [] and body["roadmap"] is None
    assert body["email"] == "user@example.com" and body["generated_on"]


def test_report_with_profile_uses_top_match(api, make_user):
    client = make_user()
    client.put("/api/profile", json=valid_profile())
    body = client.get("/api/report").json()
    assert body["profile"]["name"] == "Asha Verma"
    assert body["profile"]["stage"] and body["profile"]["skills"]
    assert 1 <= len(body["matches"]) <= 5
    assert body["matches"][0]["score"] >= body["matches"][-1]["score"]
    assert body["roadmap"]["is_target"] is False
    assert body["roadmap"]["career"]["career_id"] == body["matches"][0]["career_id"]
    assert any(s["key"] == "projects" and s["items"] for s in body["roadmap"]["stages"])
    assert 1 <= len(body["next_steps"]) <= 3
    assert body["tests"] == {}


def test_report_uses_target_and_its_progress(api, make_user):
    client = make_user()
    client.put("/api/profile", json=valid_profile())
    client.put("/api/roadmap/CAR_LAWYER/target")
    road = client.get("/api/roadmap/CAR_LAWYER").json()
    skill = next(i for s in road["stages"] if s["key"] == "core" for i in s["items"])
    client.put(f"/api/roadmap/CAR_LAWYER/skills/{skill['skill_id']}", json={"done": True})
    body = client.get("/api/report").json()
    assert body["roadmap"]["is_target"] is True and body["roadmap"]["career"]["career_id"] == "CAR_LAWYER"
    assert body["roadmap"]["progress"]["done"] == 1
    core = next(s for s in body["roadmap"]["stages"] if s["key"] == "core")
    assert skill["name"] not in core["items"]  # learned skills are left out



def test_report_has_summary_skill_gap_and_plan(api, make_user):
    client = make_user()
    client.put("/api/profile", json=valid_profile())
    body = client.get("/api/report").json()
    gap, plan, summary = body["skill_gap"], body["action_plan"], body["summary"]
    assert gap["career"]["career_id"] == body["roadmap"]["career"]["career_id"]
    assert 0 <= gap["have"] <= gap["total"] and gap["total"] > 0
    assert len(gap["missing"]) <= 5
    assert set(plan) == {"month", "quarter", "year"} and any(plan.values())
    kinds = {i["kind"] for items in plan.values() for i in items}
    assert kinds <= {"action", "learn", "continue", "project", "exam", "study", "apply"}
    assert summary["best_match"]["name"] == body["matches"][0]["name"]
    assert summary["skills_ready"] == {"have": gap["have"], "total": gap["total"]}
    if gap["missing"]:
        assert summary["main_gap"] == gap["missing"][0]["name"]
    assert all("reasons" in s for s in body["next_steps"])


def test_report_skill_gap_counts_roadmap_ticks(api, make_user):
    client = make_user()
    client.put("/api/profile", json=valid_profile())
    client.put("/api/roadmap/CAR_LAWYER/target")
    before = client.get("/api/report").json()["skill_gap"]
    first = before["missing"][0]
    client.put(f"/api/roadmap/CAR_LAWYER/skills/{first['skill_id']}", json={"done": True})
    after = client.get("/api/report").json()["skill_gap"]
    assert after["have"] == before["have"] + 1
    assert first["skill_id"] not in {i["skill_id"] for i in after["missing"]}


def test_report_without_profile_has_no_plan(api, make_user):
    body = make_user().get("/api/report").json()
    assert body["skill_gap"] is None and body["action_plan"] is None and body["summary"] is None
