"""Official syllabus links on exam cards (Resources API)."""
import pytest

from catalog.seed import seed
from database import SessionLocal


@pytest.fixture
def api(client):
    with SessionLocal() as db:
        seed(db, force=True)
    return client


def exams(api, **params):
    return {e["exam_id"]: e for e in api.get("/api/resources/exams", params=params).json()["items"]}


def test_exams_carry_their_official_syllabus(api):
    items = exams(api)
    gre = items["EXM_GRE"]["syllabus"]
    assert gre["url"].startswith("https://www.ets.org/") and gre["format"] == "page"
    assert gre["sections"] == ["Verbal Reasoning", "Quantitative Reasoning", "Analytical Writing"]
    jee = items["EXM_JEE_MAIN"]["syllabus"]
    assert jee["format"] == "pdf" and jee["url"].endswith(".pdf") and ".gov.in/" in jee["url"]
    assert all(s.startswith("Paper 1") for s in jee["sections"])
    assert items["EXM_NEET_UG"]["syllabus"]["sections"] == []  # link only
    # Exams without a verified syllabus link keep None (the card links to the official site instead)
    assert items["EXM_CAT"]["syllabus"] is None
    assert sum(1 for e in items.values() if e["syllabus"]) == 11
    assert all(e["syllabus"]["url"].startswith("https://") for e in items.values() if e["syllabus"])
