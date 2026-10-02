"""Phase 26: college predictor from JoSAA closing ranks."""
import pytest

from catalog.seed import seed
from database import SessionLocal
from engine.predictor import band


@pytest.fixture
def api(client):
    with SessionLocal() as db:
        seed(db, force=True)
    return client


def test_bands():
    assert band(80, 100) == "likely"
    assert band(100, 100) == "borderline" and band(110, 100) == "borderline"
    assert band(111, 100) == "unlikely"


def test_top_advanced_rank_gets_top_iits(api):
    body = api.get("/api/predictor", params={"exam": "EXM_JEE_ADVANCED", "rank": 50, "program": "EDU_BTECH_CSE"}).json()
    names = [i["institute_name"] for i in body["items"] if i["band"] == "likely"]
    assert "Indian Institute of Technology Bombay" in names
    assert all(i["institute_type"] == "iit" for i in body["items"])
    assert body["source"]["year"] == 2025 and "josaa" in body["source"]["url"]


def test_bands_are_ordered_and_unlikely_hidden_by_default(api):
    body = api.get("/api/predictor", params={"exam": "EXM_JEE_MAIN", "rank": 15000}).json()
    bands = [i["band"] for i in body["items"]]
    assert bands == sorted(bands, key=["likely", "borderline"].index)
    assert "unlikely" not in bands and body["counts"]["likely"] > 0
    wider = api.get("/api/predictor", params={"exam": "EXM_JEE_MAIN", "rank": 15000, "include_unlikely": True}).json()
    assert wider["counts"]["unlikely"] > 0 and wider["total"] > body["total"]


def test_female_pool_and_category_rank(api):
    base = {"exam": "EXM_JEE_MAIN", "rank": 20000, "program": "EDU_BTECH_CSE"}
    neutral = api.get("/api/predictor", params=base).json()["total"]
    female = api.get("/api/predictor", params={**base, "female": True}).json()["total"]
    assert female >= neutral
    sc = api.get("/api/predictor", params={**base, "rank": 3000, "seat_type": "SC"}).json()
    assert sc["total"] > 0


@pytest.mark.parametrize("params", [{"exam": "EXM_GATE", "rank": 10}, {"exam": "EXM_JEE_MAIN", "rank": 0},
                                    {"exam": "EXM_JEE_MAIN", "rank": 10, "seat_type": "XYZ"}])
def test_bad_input(api, params):
    assert api.get("/api/predictor", params=params).status_code == 422
