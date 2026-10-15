"""Costs and help: official fee figures per study path, with matching scholarships."""
import pytest

from catalog.seed import seed
from catalog.validator import validate
from database import SessionLocal


@pytest.fixture
def api(client):
    with SessionLocal() as db:
        seed(db, force=True)
    return client


def test_fees_come_only_from_official_institute_notices():
    report, tables = validate()
    assert report.ok, report.errors[:5]
    rows = tables["fee_examples.csv"]
    assert rows and all(r["source_url"].startswith("https://") for r in rows)
    hosts = {r["source_url"].split("/")[2] for r in rows}
    assert hosts <= {"home.iitd.ac.in", "www.nitt.edu"}


def test_btech_branch_shows_official_fees_and_scholarships(api):
    body = api.get("/api/fees", params={"stage": "EDU_BTECH_CIVIL"}).json()
    assert body["stage"]["stage_id"] == "EDU_BTECH_CIVIL" and body["has_official_fees"]
    iitd = next(f for f in body["fees"] if f["fee_id"] == "FEE_IITD_BTECH_S1_ABOVE5L")
    assert iitd["amount"] == 131000 and iitd["period"] == "first_semester" and "iitd.ac.in" in iitd["source_url"]
    nitt = next(f for f in body["fees"] if f["fee_id"] == "FEE_NITT_BTECH_TOTAL_GEN")
    assert nitt["amount"] == 663750
    names = {s["name"] for s in body["scholarships"]}
    assert "AICTE Pragati Scholarship for Girl Students" in names


def test_income_band_filters_to_what_you_would_pay(api):
    body = api.get("/api/fees", params={"stage": "EDU_BTECH_MECH", "band": "income_below_1l"}).json()
    assert body["band"] == "income_below_1l"
    assert [f["fee_id"] for f in body["fees"]] == ["FEE_IITD_BTECH_S1_BELOW1L"]
    assert body["fees"][0]["amount"] == 31000


def test_no_official_figure_says_so(api):
    body = api.get("/api/fees", params={"stage": "EDU_MBBS"}).json()
    assert body["has_official_fees"] is False and body["fees"] == []
    assert api.get("/api/fees", params={"stage": "EDU_NOPE"}).status_code == 404
    assert api.get("/api/fees", params={"stage": "EDU_BTECH_CSE", "band": "rich"}).status_code == 422
