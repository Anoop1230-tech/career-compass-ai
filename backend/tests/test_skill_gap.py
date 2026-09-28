"""Skill Gap Analysis: priorities, levels, time estimates and the API."""
import pytest

from catalog.seed import seed
from database import SessionLocal
from engine.catalog_data import get_catalog
from engine.context import StageGuess, UserContext
from engine.skill_gap import UnknownCareer, skill_gap, weeks_between
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


def ctx(**skills):
    return UserContext(has_profile=True, stage=StageGuess("EDU_BTECH_CSE", True, ""), skills=skills)


def test_weeks_between_levels():
    assert weeks_between(0, 1) == 3
    assert weeks_between(0, 3) == 16
    assert weeks_between(2, 3) == 8
    assert weeks_between(3, 2) == 0


def test_no_skills_means_everything_is_a_gap(catalog):
    gap = skill_gap(catalog, ctx(), "CAR_DATA_SCIENTIST")
    assert gap["readiness"] == 0 and gap["have"] == [] and gap["has_skills"] is False
    total = len(catalog.career_skills["CAR_DATA_SCIENTIST"])
    assert len(gap["learn_first"]) + len(gap["learn_next"]) == total
    assert gap["core_total"] == len(gap["learn_first"]) and gap["core_ready"] == 0
    # Ranks are 1..n in priority order, core skills first
    ranks = [i["rank"] for i in gap["learn_first"] + gap["learn_next"]]
    assert ranks == list(range(1, total + 1))  # continuous across both tables
    priorities = [i["priority"] for i in gap["learn_first"]]
    assert priorities == sorted(priorities, reverse=True)
    assert gap["estimate"]["all_weeks"] >= gap["estimate"]["core_weeks"] > 0


def test_levels_decide_have_partial_missing(catalog):
    links = {l.skill_id: l for l in catalog.career_skills["CAR_DATA_SCIENTIST"]}
    python_need = {"beginner": 1, "intermediate": 2, "advanced": 3}[links["SKL_PYTHON"].proficiency_required]
    gap = skill_gap(catalog, ctx(SKL_PYTHON=python_need, SKL_STATISTICS=1, SKL_FIGMA=3), "CAR_DATA_SCIENTIST")
    assert "Python" in [i["name"] for i in gap["have"]]
    stats = next(i for i in gap["learn_first"] + gap["learn_next"] if i["skill_id"] == "SKL_STATISTICS")
    assert stats["status"] == "partial" and stats["current_level"] == "beginner"
    assert stats["weeks"] == weeks_between(1, {"beginner": 1, "intermediate": 2, "advanced": 3}[stats["required_level"]])
    assert gap["transferable"] == ["Figma"]  # a skill you have that this career does not list
    assert 0 < gap["readiness"] < 100


def test_all_skills_at_level_means_ready(catalog):
    levels = {"beginner": 1, "intermediate": 2, "advanced": 3}
    skills = {l.skill_id: levels[l.proficiency_required] for l in catalog.career_skills["CAR_DATA_ANALYST"]}
    gap = skill_gap(catalog, ctx(**skills), "CAR_DATA_ANALYST")
    assert gap["readiness"] == 100 and gap["learn_first"] == [] and gap["learn_next"] == []
    assert gap["estimate"] == {"core_weeks": 0, "all_weeks": 0, "hours_per_week": 8}


def test_unknown_career(catalog):
    with pytest.raises(UnknownCareer):
        skill_gap(catalog, ctx(), "CAR_NOPE")


def test_api(api, make_user):
    assert api.get("/api/skill-gap/CAR_DATA_SCIENTIST").status_code == 401
    client = make_user()
    assert client.get("/api/skill-gap/CAR_DATA_SCIENTIST").status_code == 404  # no profile yet
    client.put("/api/profile", json=valid_profile())
    body = client.get("/api/skill-gap/CAR_DATA_SCIENTIST").json()
    assert body["career"]["name"] == "Data Scientist"
    # Profile has Python (intermediate) and SQL (beginner); Pandas comes from a project
    names = {i["name"]: i for i in body["have"] + body["learn_first"] + body["learn_next"]}
    assert names["Python"]["current_level"] == "intermediate"
    assert names["Pandas"]["source"] == "project"
    assert client.get("/api/skill-gap/CAR_NOPE").status_code == 404
