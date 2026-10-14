"""Exams, colleges, universities and scholarships: data rules and API filters."""
import pytest

from catalog.schema import SPECS
from catalog.seed import seed
from catalog.validator import validate
from database import SessionLocal
from tests.conftest import valid_profile


@pytest.fixture
def api(client):
    with SessionLocal() as db:
        seed(db, force=True)
    return client


def test_new_datasets_are_validated_and_not_fabricated():
    report, tables = validate()
    assert report.ok, report.errors[:5]
    for name in ("universities.csv", "colleges.csv", "scholarships.csv"):
        assert name in SPECS and tables[name], name
        for row in tables[name]:
            assert row["official_url"].startswith("https://")
    # Nothing is claimed as verified, and no fees or ranks are made up
    assert all(r["verified"] == "false" for r in tables["scholarships.csv"])
    assert all(not r["nirf_rank"] for r in tables["colleges.csv"] + tables["universities.csv"])
    assert all(r["fees_note"] == "Check the official website" for r in tables["colleges.csv"])


def test_validator_rejects_bad_college_references(tmp_path):
    import shutil

    from catalog.schema import DATASETS_DIR
    for f in DATASETS_DIR.glob("*.csv"):
        shutil.copy(f, tmp_path / f.name)
    path = tmp_path / "colleges.csv"
    lines = path.read_text(encoding="utf-8").splitlines()
    lines[1] = lines[1].replace("EXM_JEE_ADVANCED", "EXM_NOT_REAL")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    report, _ = validate(tmp_path)
    assert any("EXM_NOT_REAL" in e for e in report.errors)


def test_colleges_filters(api):
    all_items = api.get("/api/resources/colleges").json()
    assert all_items["total"] == 22
    gate = api.get("/api/resources/colleges?exam=EXM_GATE").json()["items"]
    assert gate and all("GATE" in [e["name"] for e in c["exams"]] for c in gate)
    mba = api.get("/api/resources/colleges?stage=EDU_MBA").json()["items"]
    assert {"Indian Institute of Management Ahmedabad"} <= {c["name"] for c in mba}
    tn = api.get("/api/resources/colleges?state=Tamil Nadu").json()["items"]
    assert tn and all(c["state"] == "Tamil Nadu" for c in tn)
    assert api.get("/api/resources/colleges?q=surathkal").json()["items"][0]["college_id"] == "COL_NITK"
    du = next(c for c in all_items["items"] if c["college_id"] == "COL_DU_CS")
    assert du["university"] == "University of Delhi"


def test_universities_and_filters_endpoint(api):
    body = api.get("/api/resources/universities?type=central").json()
    assert body["total"] >= 5 and all(u["type"] == "central" for u in body["items"])
    f = api.get("/api/resources/filters").json()
    assert "Delhi" in f["states"] and {"value": "deemed", "label": "Deemed university"} in f["institution_types"]


def test_scholarships_and_exams_for_my_stage(api, make_user):
    visitor = api.get("/api/resources/scholarships?for_me=true").json()
    assert visitor["stage"] is None and "Log in" in visitor["note"] and visitor["total"] == 11

    client = make_user()
    client.put("/api/profile", json=valid_profile())
    mine = client.get("/api/resources/scholarships?for_me=true").json()
    assert mine["stage"] == "EDU_BTECH_CSE"
    names = {s["name"] for s in mine["items"]}
    assert "AICTE Pragati Scholarship for Girl Students" in names
    assert "Prime Minister's Research Fellowship" not in names  # PhD only
    exams = client.get("/api/resources/exams?for_me=true").json()
    assert "GATE" in {e["name"] for e in exams["items"]} and "JEE Main" not in {e["name"] for e in exams["items"]}
    # An explicit stage wins over the profile
    assert client.get("/api/resources/exams?for_me=true&stage=EDU_12_PCM").json()["stage"] == "EDU_12_PCM"
    private = api.get("/api/resources/scholarships?provider_type=private").json()["items"]
    assert [s["scholarship_id"] for s in private] == ["SCH_RELIANCE_UG"]
    assert api.get("/api/resources/exams?level=government_job").json()["total"] == 18
