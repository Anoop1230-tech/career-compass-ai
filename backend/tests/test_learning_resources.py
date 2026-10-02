"""Courses and certifications: dataset rules, loading, and links on roadmap steps."""
import shutil

import pytest

from catalog.models import Certification, Course
from catalog.schema import DATASETS_DIR
from catalog.seed import seed
from catalog.validator import validate
from database import SessionLocal
from engine.catalog_data import get_catalog
from engine.context import StageGuess, UserContext
from engine.roadmap import build_roadmap


@pytest.fixture
def data_copy(tmp_path):
    target = tmp_path / "datasets"
    shutil.copytree(DATASETS_DIR, target)
    return target


@pytest.fixture
def catalog():
    with SessionLocal() as db:
        seed(db, force=True)
        yield get_catalog(db)


def replace_in(path, old, new):
    text = path.read_text(encoding="utf-8")
    assert old in text, f"test setup: '{old}' not found in {path.name}"
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def errors_for(folder) -> str:
    report, _ = validate(folder)
    return "\n".join(report.errors)


def ctx(stage="EDU_BTECH_CSE", **skills):
    return UserContext(has_profile=True, stage=StageGuess(stage, True, ""), skills=skills)


def test_datasets_have_courses_and_certifications():
    report, tables = validate()
    assert report.ok
    assert len(tables["courses.csv"]) >= 80
    assert len(tables["certifications.csv"]) >= 20
    # Every course and certification links to an https page
    for name, column in (("courses.csv", "url"), ("certifications.csv", "url")):
        assert all(r[column].startswith("https://") for r in tables[name]), name


def test_core_tech_skills_have_a_course(catalog):
    """Every mandatory technical skill of a Technology career has at least one course to start with.
    (Soft skills and performance arts are learned by practice, so they may have none.)"""
    missing = sorted({
        link.skill_id
        for cid, career in catalog.careers.items() if career.domain == "Technology"
        for link in catalog.career_skills.get(cid, []) if link.is_mandatory
        if catalog.skills[link.skill_id].category in {"technical", "programming", "math"}
        if not catalog.courses_by_skill.get(link.skill_id)
    })
    assert missing == []


@pytest.mark.parametrize("file,old,new,expected", [
    ("courses.csv", "CRS_PY4E,", "PY4E,", "must start with 'CRS_'"),
    ("courses.csv", ",SKL_PYTHON,beginner,free,", ",SKL_PYTHONN,beginner,free,", "unknown id 'SKL_PYTHONN'"),
    ("courses.csv", ",SKL_PYTHON,beginner,free,", ",SKL_PYTHON,beginner,cheap,", "invalid value 'cheap'"),
    ("courses.csv", ",SKL_PYTHON,beginner,free,", ",SKL_PYTHON,expert,free,", "invalid value 'expert'"),
    ("courses.csv", "https://www.py4e.com/", "www.py4e.com", "not a valid http(s) URL"),
    ("certifications.csv", "CAR_CHEF,SKL_FOOD_SAFETY", "CAR_COOK,SKL_FOOD_SAFETY", "unknown id 'CAR_COOK'"),
    ("certifications.csv", ",foundation,None,", ",beginner,None,", "invalid value 'beginner'"),
    ("certifications.csv", "Paid exam; check the official page for the current fee,3,2026", "Paid exam; check the official page for the current fee,30,2026",
     "whole number from 1 to 10"),
])
def test_validator_catches_resource_mistakes(data_copy, file, old, new, expected):
    replace_in(data_copy / file, old, new)
    assert expected in errors_for(data_copy)


def test_resources_are_loaded(catalog):
    with SessionLocal() as db:
        course = db.get(Course, "CRS_CS50P")
        assert course.skill_ids == ["SKL_PYTHON", "SKL_OOP"]
        assert course.cost_type == "free" and course.certificate_available is True
        assert db.get(Course, "CRS_MOOC_JAVA").certificate_available is None  # unknown stays unknown
        cert = db.get(Certification, "CRT_AWS_CCP")
        assert "CAR_CLOUD_ENGINEER" in cert.related_career_ids and cert.validity_years == 3


def test_courses_for_prefers_matching_level_then_free(catalog):
    beginner = catalog.courses_for("SKL_ML", "beginner")
    assert [c.level for c in beginner] == ["beginner", "beginner"]
    assert beginner[0].cost_type == "free"
    advanced = catalog.courses_for("SKL_NLP", "advanced", limit=1)
    assert advanced[0].course_id == "CRS_CS224N"
    assert catalog.courses_for("SKL_DOES_NOT_EXIST") == []


def test_roadmap_skill_steps_link_courses(catalog):
    r = build_roadmap(catalog, ctx(), "CAR_DATA_SCIENTIST")
    skills = [i for s in r["stages"] for i in s["items"] if i["kind"] == "skill"]
    with_courses = [i for i in skills if i["courses"]]
    assert len(with_courses) >= len(skills) * 0.8
    course = with_courses[0]["courses"][0]
    assert set(course) == {"course_id", "name", "provider", "url", "level", "cost_type", "certificate_available"}
    assert all(len(i["courses"]) <= 2 for i in skills)


def test_roadmap_get_in_stage_lists_certifications(catalog):
    r = build_roadmap(catalog, ctx(), "CAR_CLOUD_ENGINEER")
    apply = next(s for s in r["stages"] if s["key"] == "apply")
    certs = next(i for i in apply["items"] if i["kind"] == "certifications")["certifications"]
    assert 1 <= len(certs) <= 3
    assert certs[0]["level"] == "foundation"  # entry-level first
    assert all(c["url"].startswith("https://") for c in certs)


def test_roadmap_without_certifications_has_no_empty_item(catalog):
    career_id = next(cid for cid in catalog.careers if cid not in catalog.certifications_by_career)
    r = build_roadmap(catalog, ctx(), career_id)
    apply = next(s for s in r["stages"] if s["key"] == "apply")
    assert all(i["kind"] != "certifications" for i in apply["items"])


def test_roadmap_api_includes_courses(client):
    with SessionLocal() as db:
        seed(db, force=True)
    body = client.get("/api/roadmap/CAR_FRONTEND_DEVELOPER").json()
    items = [i for s in body["stages"] for i in s["items"] if i["kind"] == "skill"]
    assert any(c["url"].startswith("https://") for i in items for c in i["courses"])
