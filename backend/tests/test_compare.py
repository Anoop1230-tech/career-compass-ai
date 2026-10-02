"""Phase 22: compare 2–3 careers side by side."""
import pytest

from catalog.seed import seed
from database import SessionLocal
from tests.conftest import valid_profile


@pytest.fixture
def api(client):
    with SessionLocal() as db:
        seed(db, force=True)
    return client


def test_compare_two_careers_as_visitor(api):
    r = api.get("/api/compare", params={"ids": "CAR_DATA_SCIENTIST,CAR_DOCTOR_MBBS", "stage": "EDU_12_PCM"})
    assert r.status_code == 200
    body = r.json()
    assert [c["career_id"] for c in body["careers"]] == ["CAR_DATA_SCIENTIST", "CAR_DOCTOR_MBBS"]
    ds, doc = body["careers"]
    assert ds["core_skills"] and doc["core_skills"]
    assert ds["route"]["reachable"] is True and ds["route"]["years"] > 0
    assert doc["route"]["reachable"] is False  # MBBS needs Biology; PCM has no recorded route
    assert any(e["name"] == "NEET UG" for e in doc["exams"])
    assert ds["fit"] is None and body["personalised"] is False
    assert body["stage"]["stage_id"] == "EDU_12_PCM"


def test_shared_skills_and_three_careers(api):
    body = api.get("/api/compare", params={"ids": "CAR_DATA_SCIENTIST,CAR_DATA_ANALYST,CAR_ML_ENGINEER"}).json()
    assert len(body["careers"]) == 3
    assert body["shared_skills"]  # these three overlap
    assert body["careers"][0]["route"] is None  # no stage given and no profile


@pytest.mark.parametrize("ids", ["CAR_DATA_SCIENTIST", "CAR_A,CAR_B,CAR_C,CAR_D", "CAR_DATA_SCIENTIST,CAR_DATA_SCIENTIST"])
def test_needs_two_or_three_different_careers(api, ids):
    r = api.get("/api/compare", params={"ids": ids})
    assert r.status_code == 422
    assert r.json()["code"] == "compare.count"


def test_unknown_career_is_404(api):
    r = api.get("/api/compare", params={"ids": "CAR_DATA_SCIENTIST,CAR_NOPE"})
    assert r.status_code == 404 and r.json()["code"] == "career.not_found"


def test_logged_in_adds_fit_and_uses_profile_stage(api, make_user):
    auth_client = make_user()
    auth_client.put("/api/profile", json=valid_profile())
    body = auth_client.get("/api/compare", params={"ids": "CAR_SOFTWARE_ENGINEER,CAR_LAWYER"}).json()
    assert body["personalised"] is True
    sw, law = body["careers"]
    assert 0 <= sw["fit"]["score"] <= 100 and 0 <= sw["fit"]["readiness"] <= 100
    assert sw["fit"]["readiness"] > law["fit"]["readiness"]  # the sample profile has programming skills
    assert body["stage"] is not None
