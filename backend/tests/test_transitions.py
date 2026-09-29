"""Transition Engine / Dream Career Checker."""
import pytest

from catalog.seed import seed
from database import SessionLocal
from engine.catalog_data import get_catalog
from engine.context import UserContext
from engine.transitions import UnknownTarget, career_chain, check_transition, education_route
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


def check(catalog, to, **kw):
    return check_transition(catalog, UserContext(), to, **kw)


def test_education_route_is_shortest_chain(catalog):
    creative = check(catalog, "CAR_SINGER", from_stage="EDU_BTECH_CSE")
    assert creative["verdict"] == "achievable"
    assert [s["id"] for s in creative["education_route"]] == ["EDU_COURSE_MUSIC", "CAR_SINGER"]
    assert creative["blockers"] == []  # no degree or entrance exam needed
    assert "about 1 year)" in creative["reasons"][0]
    route = education_route(catalog, "EDU_12_PCM", "CAR_DATA_SCIENTIST")
    assert [s["type"] for s in route] == ["education", "career"]
    assert route[-1]["id"] == "CAR_DATA_SCIENTIST"
    assert education_route(catalog, "EDU_BTECH_CSE", "CAR_SOFTWARE_ENGINEER")[0]["id"] == "CAR_SOFTWARE_ENGINEER"
    # The shortest route wins: BCA leads to software jobs directly, not via MCA
    assert len(education_route(catalog, "EDU_BCA", "CAR_SOFTWARE_ENGINEER")) == 1
    assert education_route(catalog, "EDU_12_PCB", "CAR_SOFTWARE_ENGINEER") is None


def test_career_chain(catalog):
    chain = career_chain(catalog, "CAR_SOFTWARE_ENGINEER", "CAR_ENGINEERING_MANAGER")
    assert chain and chain[-1]["id"] == "CAR_ENGINEERING_MANAGER"
    assert career_chain(catalog, "CAR_ACCOUNTANT", "CAR_VLSI_ENGINEER") is None


@pytest.mark.parametrize("to, kw, verdict", [
    ("CAR_SOFTWARE_ENGINEER", {"from_stage": "EDU_BTECH_CSE"}, "direct"),
    ("CAR_DATA_SCIENTIST", {"from_stage": "EDU_12_PCM"}, "achievable"),
    ("CAR_DATA_ANALYST", {"from_career": "CAR_SCHOOL_TEACHER"}, "achievable"),
    ("CAR_ENGINEERING_MANAGER", {"from_career": "CAR_SOFTWARE_ENGINEER"}, "direct"),
    ("CAR_SOFTWARE_ENGINEER", {"from_stage": "EDU_12_PCB"}, "not_direct"),
    ("CAR_AI_RESEARCH_SCIENTIST", {"from_stage": "EDU_BCOM"}, "not_direct"),
    ("CAR_VLSI_ENGINEER", {"from_stage": "EDU_BCA"}, "hard"),
    ("CAR_DATA_ANALYST", {"from_career": "CAR_DATA_ANALYST"}, "direct"),
])
def test_verdicts(catalog, to, kw, verdict):
    result = check(catalog, to, **kw)
    assert result["verdict"] == verdict
    assert result["reasons"] or result["blockers"]  # always explains itself


def test_details_of_an_achievable_route(catalog):
    r = check(catalog, "CAR_DATA_SCIENTIST", from_stage="EDU_12_PCM")
    assert r["time"]["months_min"] == 48  # four-year B.Tech
    assert any("JEE Main" in b for b in r["blockers"])
    assert any("bachelor's" in b for b in r["blockers"])
    assert r["alternatives"] == []  # only offered when the dream is hard

    switch = check(catalog, "CAR_DATA_ANALYST", from_career="CAR_SCHOOL_TEACHER")["switch"]
    assert switch["months_min"] == 6 and switch["steps"] and "SQL" in switch["skills_missing"]


def test_alternatives_for_hard_dreams(catalog):
    r = check(catalog, "CAR_VLSI_ENGINEER", from_stage="EDU_BCA")
    assert r["alternatives"] and all(a["career_id"] != "CAR_VLSI_ENGINEER" for a in r["alternatives"])


def test_unknown_ids(catalog):
    for kw in ({"from_stage": "EDU_NOPE"}, {"from_career": "CAR_NOPE"}):
        with pytest.raises(UnknownTarget):
            check(catalog, "CAR_DATA_ANALYST", **kw)
    with pytest.raises(UnknownTarget):
        check(catalog, "CAR_NOPE", from_stage="EDU_BCA")


def test_api_for_visitor_and_profile(api, make_user):
    body = api.get("/api/transitions/check?to=CAR_DATA_SCIENTIST&from_stage=EDU_12_PCM").json()
    assert body["verdict"] == "achievable" and body["source"] == "query" and body["personalised"] is False
    # A visitor without a starting point gets a clear 422
    response = api.get("/api/transitions/check?to=CAR_DATA_SCIENTIST")
    assert response.status_code == 422 and "where you are" in response.json()["detail"]
    assert api.get("/api/transitions/check?to=CAR_NOPE&from_stage=EDU_BCA").status_code == 404
    assert api.get("/api/transitions/check?from_stage=EDU_BCA").status_code == 422  # target missing

    client = make_user()
    client.put("/api/profile", json=valid_profile())
    body = client.get("/api/transitions/check?to=CAR_DATA_SCIENTIST").json()
    assert body["source"] == "profile" and body["from"]["stage"]["stage_id"] == "EDU_BTECH_CSE"
    assert body["verdict"] == "direct" and body["personalised"] is True
    assert body["skills"]["readiness"] > 0  # Python + SQL from the profile count
