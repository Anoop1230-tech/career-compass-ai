"""Seeding: loads correctly, is safe to re-run, and never damages data."""
import shutil

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app import app
from catalog.models import Career, CareerSkill, EducationPath, Exam, Skill, Stage
from catalog.schema import DATASETS_DIR
from catalog.seed import SeedError, is_loaded, seed
from database import SessionLocal
from models import User

from .conftest import valid_profile


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def data_copy(tmp_path):
    target = tmp_path / "datasets"
    shutil.copytree(DATASETS_DIR, target)
    return target


def test_first_load_fills_every_table(db):
    result = seed(db)
    assert result["status"] == "loaded"
    counts = result["counts"]
    assert counts["stages"] == 29
    assert counts["careers"] == 59
    assert counts["skills"] >= 150
    assert counts["career_skills"] >= 290
    assert counts["exams"] == 16
    assert counts["education_paths"] >= 60


def test_values_are_converted_to_proper_types(db):
    seed(db)
    career = db.get(Career, "CAR_DATA_SCIENTIST")
    assert career.riasec_codes == ["I", "C"]
    assert "EDU_BTECH_CSE" in career.typical_stage_ids
    assert career.last_verified.isoformat() == "2026-09-28"
    assert career.skill_links[0].importance == 5  # sorted by importance
    link = db.get(CareerSkill, ("CAR_DATA_SCIENTIST", "SKL_PYTHON"))
    assert link.is_mandatory is True
    exam = db.get(Exam, "EXM_GATE")
    assert exam.verified is False
    assert exam.official_url.startswith("https://")
    assert db.get(Skill, "SKL_PYTHON").aliases == ["py", "python3"]
    assert db.get(EducationPath, "EP_023").required_exam_ids == ["EXM_GATE"]
    assert db.get(Stage, "EDU_WORKING_TECH").typical_duration_years is None


def test_second_run_is_skipped_and_force_reloads(db):
    assert seed(db)["status"] == "loaded"
    assert seed(db)["status"] == "unchanged"
    assert seed(db, force=True)["status"] == "loaded"
    assert db.query(Career).count() == 59  # no duplicates after reloading


def test_changed_csv_is_picked_up(db, data_copy):
    seed(db, data_copy)
    path = data_copy / "careers.csv"
    path.write_text(path.read_text(encoding="utf-8").replace("Data Scientist,", "Data Scientist (updated),", 1),
                    encoding="utf-8")
    assert seed(db, data_copy)["status"] == "loaded"
    db.expire_all()
    assert db.get(Career, "CAR_DATA_SCIENTIST").name == "Data Scientist (updated)"


def test_invalid_data_changes_nothing(db, data_copy):
    seed(db, data_copy)
    path = data_copy / "skill_career_mapping.csv"
    path.write_text(path.read_text(encoding="utf-8").replace("SKL_DSA,5", "SKL_GHOST,5", 1), encoding="utf-8")
    with pytest.raises(SeedError, match="nothing was loaded"):
        seed(db, data_copy)
    # The previous, valid data is still fully there
    assert db.query(Career).count() == 59
    assert db.get(CareerSkill, ("CAR_SOFTWARE_ENGINEER", "SKL_DSA")) is not None


def test_reseeding_never_touches_users_or_profiles(make_user, db):
    client = make_user("keep@example.com")
    client.put("/api/profile", json=valid_profile())
    seed(db, force=True)
    assert db.scalar(select(User).where(User.email == "keep@example.com")) is not None
    assert client.get("/api/profile").json()["full_name"] == "Asha Verma"


def test_server_start_loads_data_automatically(monkeypatch, db):
    from config import settings

    monkeypatch.setattr(settings, "AUTO_SEED", True)
    assert not is_loaded(db)
    with TestClient(app):  # entering the context runs the startup code
        pass
    assert is_loaded(db)


def test_server_starts_even_if_datasets_are_broken(monkeypatch, db):
    import catalog.seed as seed_module
    from config import settings

    def broken(*_args, **_kwargs):
        raise SeedError("simulated bad data")

    monkeypatch.setattr(settings, "AUTO_SEED", True)
    monkeypatch.setattr(seed_module, "seed", broken)
    with TestClient(app) as client:
        assert client.get("/api/health").status_code == 200



def test_question_banks_are_loaded(db):
    from catalog.models import AptitudeQuestion, InterestQuestion, PersonalityQuestion

    seed(db)
    assert db.query(InterestQuestion).count() == 36
    assert db.query(PersonalityQuestion).count() == 30
    q = db.get(AptitudeQuestion, "AQ_N01")
    assert set(q.options) == {"a", "b", "c", "d"}
    assert q.options[q.correct_option] == "\u20b91000"
    assert db.get(PersonalityQuestion, "PQ_E02").keyed == "-"


def test_table_layout_change_triggers_reload(db, monkeypatch):
    import catalog.seed as seed_module

    seed(db)
    assert seed(db)["status"] == "unchanged"
    # Simulate a new table being added in a later version of the code
    monkeypatch.setattr(seed_module, "DELETE_ORDER", seed_module.DELETE_ORDER[:-1])
    assert seed_module.fingerprint(DATASETS_DIR) != db.get(seed_module.CatalogMeta, "fingerprint").value
