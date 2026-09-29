"""Roadmap Generator, progress tracking and the Career Explorer."""
import pytest

from catalog.seed import seed
from database import SessionLocal
from engine.catalog_data import get_catalog
from engine.context import StageGuess, UserContext
from engine.explore import UnknownNode, children
from engine.roadmap import UnknownCareer, build_roadmap
from tests.conftest import valid_profile


@pytest.fixture
def catalog():
    with SessionLocal() as db:
        seed(db, force=True)
        yield get_catalog(db)


@pytest.fixture
def api(client):
    with SessionLocal() as db:
        seed(db, force=True)
    return client


def ctx(stage=None, **skills):
    return UserContext(has_profile=True, stage=StageGuess(stage, True, ""), skills=skills)


def keys(roadmap):
    return [s["key"] for s in roadmap["stages"]]


def test_roadmap_stages_in_order(catalog):
    r = build_roadmap(catalog, ctx("EDU_BTECH_CSE"), "CAR_DATA_SCIENTIST")
    assert keys(r)[0] in {"foundations", "core"} and keys(r)[-2:] == ["projects", "apply"]
    assert [s["order"] for s in r["stages"]] == list(range(1, len(r["stages"]) + 1))
    assert r["progress"] == {"done": 0, "total": len(catalog.career_skills["CAR_DATA_SCIENTIST"]), "percent": 0}
    assert r["total_weeks"] > 0 and r["study_years"] == 0


def test_school_student_gets_a_study_stage_and_exams(catalog):
    r = build_roadmap(catalog, ctx("EDU_12_PCM"), "CAR_SOFTWARE_ENGINEER")
    assert keys(r)[0] == "study"
    assert r["stages"][0]["items"][0]["title"] == "B.Tech – Computer Science"
    assert r["study_years"] == 4
    study_exams = [e["name"] for e in r["stages"][0]["items"][0]["exams"]]
    assert "JEE Main" in study_exams


def test_known_skills_are_skipped(catalog):
    levels = {"beginner": 1, "intermediate": 2, "advanced": 3}
    known = {l.skill_id: levels[l.proficiency_required] for l in catalog.career_skills["CAR_DATA_ANALYST"][:3]}
    r = build_roadmap(catalog, ctx("EDU_BCOM", **known), "CAR_DATA_ANALYST")
    listed = {i["skill_id"] for s in r["stages"] for i in s["items"] if i["kind"] == "skill"}
    assert not (set(known) & listed)
    assert len(r["skipped"]) == 3


def test_done_skills_reduce_time_and_count_as_progress(catalog):
    before = build_roadmap(catalog, ctx("EDU_BTECH_CSE"), "CAR_ML_ENGINEER")
    first = next(i for s in before["stages"] for i in s["items"] if i["kind"] == "skill")
    after = build_roadmap(catalog, ctx("EDU_BTECH_CSE"), "CAR_ML_ENGINEER", {first["skill_id"]})
    assert after["progress"]["done"] == 1
    assert after["total_weeks"] == before["total_weeks"] - first["weeks"]
    item = next(i for s in after["stages"] for i in s["items"] if i.get("skill_id") == first["skill_id"])
    assert item["done"] is True


def test_unknown_career(catalog):
    with pytest.raises(UnknownCareer):
        build_roadmap(catalog, ctx(), "CAR_NOPE")


def test_explorer_children(catalog):
    kids = children(catalog, "stage", "EDU_12_PCM")
    assert {"B.Tech – Computer Science", "BCA"} <= {k["title"] for k in kids}
    btech = next(k for k in kids if k["id"] == "EDU_BTECH_CSE")
    assert btech["has_children"] and btech["edge"]["exams"] == ["JEE Main"]
    se = children(catalog, "career", "CAR_SOFTWARE_ENGINEER")
    assert {"Backend Developer", "Product Manager"} <= {k["title"] for k in se}
    assert any(k["edge"]["label"] == "Switch" for k in se)
    with pytest.raises(UnknownNode):
        children(catalog, "stage", "EDU_NOPE")


def test_roadmap_api_visitor(api):
    body = api.get("/api/roadmap/CAR_DATA_ANALYST").json()
    assert body["logged_in"] is False and body["personalised"] is False and body["stages"]
    assert api.get("/api/roadmap/CAR_NOPE").status_code == 404
    assert api.get("/api/roadmap").status_code == 401
    assert api.put("/api/roadmap/CAR_DATA_ANALYST/target").status_code == 401


def test_roadmap_api_target_and_progress(api, make_user):
    client = make_user()
    client.put("/api/profile", json=valid_profile())
    assert client.get("/api/roadmap").status_code == 404  # no target yet

    assert client.put("/api/roadmap/CAR_DATA_SCIENTIST/target").json()["is_target"] is True
    assert client.get("/api/roadmap").json()["career"]["career_id"] == "CAR_DATA_SCIENTIST"
    # Switching target: only one active
    client.put("/api/roadmap/CAR_ML_ENGINEER/target")
    assert client.get("/api/roadmap").json()["career"]["career_id"] == "CAR_ML_ENGINEER"
    assert client.get("/api/roadmap/CAR_DATA_SCIENTIST").json()["is_target"] is False

    r = client.put("/api/roadmap/CAR_ML_ENGINEER/skills/SKL_ML", json={"done": True}).json()
    assert r["progress"]["done"] == 1
    r = client.put("/api/roadmap/CAR_ML_ENGINEER/skills/SKL_ML", json={"done": False}).json()
    assert r["progress"]["done"] == 0
    assert client.put("/api/roadmap/CAR_ML_ENGINEER/skills/SKL_FIGMA", json={"done": True}).status_code == 404
    assert client.put("/api/roadmap/CAR_NOPE/target").status_code == 404
    assert client.put("/api/roadmap/CAR_ML_ENGINEER/skills/SKL_ML", json={}).status_code == 422


def test_progress_is_private(api, make_user):
    alice = make_user("alice@example.com")
    alice.put("/api/roadmap/CAR_DATA_ANALYST/skills/SKL_SQL", json={"done": True})
    alice.post("/api/auth/logout")
    bob = make_user("bob@example.com")
    assert bob.get("/api/roadmap/CAR_DATA_ANALYST").json()["progress"]["done"] == 0


def test_explore_api(api, make_user):
    body = api.get("/api/explore").json()
    assert body["source"] == "default" and body["root"]["id"] == "EDU_CLASS_10" and body["root"]["children"]
    assert api.get("/api/explore?stage=EDU_BCA").json()["root"]["title"] == "BCA"
    assert api.get("/api/explore?stage=EDU_NOPE").status_code == 404
    node = api.get("/api/explore/career/CAR_SOFTWARE_ENGINEER").json()
    assert node["node"]["title"] == "Software Engineer" and node["children"]
    assert api.get("/api/explore/exam/EXM_GATE").json()["children"] == []
    assert api.get("/api/explore/planet/X").status_code == 422
    assert api.get("/api/explore/career/CAR_NOPE").status_code == 404

    client = make_user()
    client.put("/api/profile", json=valid_profile())
    assert client.get("/api/explore").json()["root"]["id"] == "EDU_BTECH_CSE"



def test_school_teacher_leads_to_suitable_careers(catalog):
    """A teacher's next steps are school and learning roles, not engineering jobs."""
    kids = children(catalog, "career", "CAR_SCHOOL_TEACHER")
    ids = {k["id"] for k in kids}
    assert {"CAR_SCHOOL_PRINCIPAL", "CAR_SPECIAL_EDUCATOR", "CAR_SCHOOL_COUNSELLOR", "CAR_INSTRUCTIONAL_DESIGNER",
            "CAR_CONTENT_WRITER", "CAR_CONTENT_CREATOR", "CAR_CIVIL_SERVICES", "CAR_FITNESS_TRAINER"} == ids
    assert all(catalog.careers[i].domain != "Technology" for i in ids)
    principal = next(k for k in kids if k["id"] == "CAR_SCHOOL_PRINCIPAL")
    assert principal["edge"]["label"] == "Management" and principal["edge"]["experience"] == "8-15"
    labels = [k["edge"]["label"] for k in kids]
    assert labels.index("Switch") == 4 and set(labels[4:]) == {"Switch"}  # school roles first, then switches
