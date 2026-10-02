"""Phase 23: project briefs with checklists in the roadmap's "Prove it" stage."""
import pytest

from catalog.seed import seed
from database import SessionLocal
from tests.conftest import valid_profile


@pytest.fixture
def api(client):
    with SessionLocal() as db:
        seed(db, force=True)
    return client


def _projects(roadmap):
    stage = next(s for s in roadmap["stages"] if s["key"] == "projects")
    return stage, [i for i in stage["items"] if i["kind"] == "project"]


def test_every_career_roadmap_has_two_or_three_projects(api):
    careers = api.get("/api/catalog/careers", params={"limit": 100}).json()["items"]
    for c in careers:
        _, projects = _projects(api.get(f"/api/roadmap/{c['career_id']}").json())
        assert 2 <= len(projects) <= 3, c["career_id"]
        for p in projects:
            assert 3 <= len(p["steps"]) <= 8 and p["deliverable"] and p["hours"] > 0 and p["skills"]


def test_projects_are_easiest_first_and_weeks_follow_hours(api):
    road = api.get("/api/roadmap/CAR_DATA_SCIENTIST").json()
    stage, projects = _projects(road)
    order = {"beginner": 0, "intermediate": 1, "advanced": 2}
    assert [order[p["level"]] for p in projects] == sorted(order[p["level"]] for p in projects)
    assert stage["weeks"] >= 1
    assert road["projects_progress"] == {"done": 0, "total": len(projects)}
    assert stage["items"][-1]["title"] == "Publish your work"


def test_ticking_steps_saves_progress(api, make_user):
    client = make_user()
    client.put("/api/profile", json=valid_profile())
    _, projects = _projects(client.get("/api/roadmap/CAR_BACKEND_DEVELOPER").json())
    p = projects[0]
    for i in range(len(p["steps"])):
        r = client.put(f"/api/roadmap/CAR_BACKEND_DEVELOPER/projects/{p['project_id']}/steps/{i}", json={"done": True})
        assert r.status_code == 200
    road = r.json()
    _, after = _projects(road)
    assert after[0]["steps_done"] == len(p["steps"]) and all(s["done"] for s in after[0]["steps"])
    assert road["projects_progress"]["done"] == 1

    r = client.put(f"/api/roadmap/CAR_BACKEND_DEVELOPER/projects/{p['project_id']}/steps/0", json={"done": False})
    _, after = _projects(r.json())
    assert after[0]["steps"][0]["done"] is False and r.json()["projects_progress"]["done"] == 0
    # Progress is kept per career and survives a reload
    _, again = _projects(client.get("/api/roadmap/CAR_BACKEND_DEVELOPER").json())
    assert again[0]["steps_done"] == len(p["steps"]) - 1


def test_bad_steps_are_rejected(api, make_user):
    client = make_user()
    _, projects = _projects(client.get("/api/roadmap/CAR_CHEF").json())
    pid = projects[0]["project_id"]
    assert client.put(f"/api/roadmap/CAR_CHEF/projects/{pid}/steps/99", json={"done": True}).status_code == 404
    r = client.put(f"/api/roadmap/CAR_CHEF/projects/PRJ_VERILOG_CPU/steps/0", json={"done": True})
    assert r.status_code == 404 and r.json()["code"] == "roadmap.step_not_in_roadmap"
    assert client.put(f"/api/roadmap/CAR_CHEF/projects/{pid}/steps/0", json={"done": "yes"}).status_code == 422


def test_visitors_cannot_tick(api):
    _, projects = _projects(api.get("/api/roadmap/CAR_CHEF").json())
    r = api.put(f"/api/roadmap/CAR_CHEF/projects/{projects[0]['project_id']}/steps/0", json={"done": True})
    assert r.status_code == 401
