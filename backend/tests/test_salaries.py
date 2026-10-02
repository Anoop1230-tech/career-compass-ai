"""Phase 25: official pay shown on career pages, with sources; nothing estimated."""
import csv

import pytest

from catalog.schema import DATASETS_DIR
from catalog.seed import seed
from database import SessionLocal


@pytest.fixture
def api(client):
    with SessionLocal() as db:
        seed(db, force=True)
    return client


def test_teacher_page_lists_official_pay_with_source(api):
    c = api.get("/api/catalog/careers/CAR_SCHOOL_TEACHER").json()
    levels = [s["level"] for s in c["salaries"]]
    assert levels == ["Level 6", "Level 7", "Level 8"]  # lowest pay first
    tgt = c["salaries"][1]
    assert tgt["monthly_min"] == 44900 and tgt["monthly_max"] == 142400
    assert tgt["source_url"].startswith("https://") and tgt["as_of"] and tgt["last_verified"]


def test_agniveer_package_and_ias_entry(api):
    soldier = api.get("/api/catalog/careers/CAR_SOLDIER").json()["salaries"]
    assert [(s["monthly_min"], s["monthly_max"]) for s in soldier] == [(30000, 40000)]
    ias = api.get("/api/catalog/careers/CAR_CIVIL_SERVICES").json()["salaries"]
    assert ias[0]["monthly_min"] == 56100 and ias[0]["monthly_max"] is None


def test_careers_without_official_pay_show_none(api):
    assert api.get("/api/catalog/careers/CAR_DATA_SCIENTIST").json()["salaries"] == []


def test_every_row_comes_from_a_government_site():
    with (DATASETS_DIR / "salary_ranges.csv").open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    assert rows
    for r in rows:
        host = r["source_url"].split("/")[2]
        assert host.endswith(".gov.in") or host.endswith(".nic.in"), r["salary_id"]


def test_validator_rejects_unofficial_sources(tmp_path):
    import shutil
    from catalog.validator import validate

    for f in DATASETS_DIR.glob("*.csv"):
        shutil.copy(f, tmp_path / f.name)
    path = tmp_path / "salary_ranges.csv"
    text = path.read_text(encoding="utf-8")
    path.write_text(text.replace("https://pib.gov.in/", "https://example.com/", 1), encoding="utf-8")
    report, _ = validate(tmp_path)
    assert any("official" in e for e in report.errors)
