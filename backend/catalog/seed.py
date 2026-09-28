"""Loads ../datasets/*.csv into the database.

Run from the backend folder:
    python -m catalog.seed            # load if the CSVs changed
    python -m catalog.seed --force    # reload even if unchanged

Safety rules:
- The CSVs are validated first. If there is any error, nothing is changed.
- All reference tables are replaced inside ONE transaction: either the whole
  new dataset is loaded, or (on any failure) the old data stays untouched.
- A fingerprint (SHA-256) of the CSV files is stored, so restarting the
  server does not reload unchanged data.
- User accounts and profiles are never touched.
"""
import hashlib
import logging
import sys
from datetime import date
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from catalog.models import (
    AptitudeQuestion,
    Career,
    CareerPath,
    CareerSkill,
    CareerTransition,
    CatalogMeta,
    EducationPath,
    Exam,
    InterestQuestion,
    PersonalityQuestion,
    Skill,
    Stage,
)
from catalog.schema import DATASETS_DIR, PLANNED_FILES, SPECS
from catalog.validator import split_ids, validate

logger = logging.getLogger("career_compass.seed")

# Delete children before parents (foreign keys)
DELETE_ORDER = [
    CareerSkill, EducationPath, CareerPath, CareerTransition, Exam, Career, Skill, Stage,
    InterestQuestion, PersonalityQuestion, AptitudeQuestion,
]


class SeedError(Exception):
    """Raised when the datasets are invalid; the database is left unchanged."""


def fingerprint(data_dir: Path) -> str:
    digest = hashlib.sha256()
    # Include the table layout, so adding a table or column triggers a reload
    for model in DELETE_ORDER:
        digest.update(model.__tablename__.encode())
        digest.update(",".join(sorted(model.__table__.columns.keys())).encode())
    for name in sorted([*SPECS, *PLANNED_FILES]):
        path = data_dir / name
        digest.update(name.encode())
        digest.update(path.read_bytes() if path.exists() else b"<missing>")
    return digest.hexdigest()


# ---- small converters: CSV text -> Python values
def text(value: str) -> str | None:
    return value or None


def number(value: str) -> float | None:
    return float(value) if value else None


def integer(value: str) -> int | None:
    return int(value) if value else None


def boolean(value: str) -> bool:
    return value == "true"


def day(value: str) -> date:
    return date.fromisoformat(value)


def build_objects(tables: dict[str, list[dict[str, str]]]) -> list:
    objects: list = []
    for r in tables["education_stages.csv"]:
        objects.append(Stage(
            stage_id=r["stage_id"], name=r["stage_name"], level=r["level"],
            stream_or_branch=text(r["stream_or_branch"]),
            typical_duration_years=number(r["typical_duration_years"]), description=text(r["description"]),
        ))
    for r in tables["skills.csv"]:
        objects.append(Skill(
            skill_id=r["skill_id"], name=r["skill_name"], category=r["category"],
            sub_category=text(r["sub_category"]), aliases=split_ids(r["aliases"]),
            description=text(r["description"]),
        ))
    for r in tables["careers.csv"]:
        objects.append(Career(
            career_id=r["career_id"], name=r["career_name"], domain=r["domain"],
            sub_domain=text(r["sub_domain"]), description=r["description"],
            min_education_level=r["min_education_level"],
            typical_stage_ids=split_ids(r["typical_education_stage_ids"]),
            riasec_codes=split_ids(r["riasec_codes"]), key_aptitudes=split_ids(r["key_aptitudes"]),
            personality_fit=split_ids(r["personality_fit"]), work_style=split_ids(r["work_style"]),
            salary_note=text(r["salary_note"]), onet_code=text(r["onet_code"]), esco_uri=text(r["esco_uri"]),
            source_url=r["source_url"], last_verified=day(r["last_verified"]),
        ))
    for r in tables["skill_career_mapping.csv"]:
        objects.append(CareerSkill(
            career_id=r["career_id"], skill_id=r["skill_id"], importance=int(r["importance"]),
            proficiency_required=r["proficiency_required"], is_mandatory=boolean(r["is_mandatory"]),
            source=text(r["source"]),
        ))
    for r in tables["entrance_exams.csv"]:
        objects.append(Exam(
            exam_id=r["exam_id"], name=r["exam_name"], full_name=r["full_name"],
            conducting_body=r["conducting_body"], exam_level=r["exam_level"], purpose=r["purpose"],
            eligible_stage_ids=split_ids(r["eligible_stage_ids"]), eligibility_summary=r["eligibility_summary"],
            age_limit_note=text(r["age_limit_note"]), frequency=text(r["frequency"]),
            typical_month=text(r["typical_month"]), official_url=r["official_url"],
            verified=boolean(r["verified"]), last_verified=day(r["last_verified"]),
        ))
    for r in tables["education_paths.csv"]:
        objects.append(EducationPath(
            path_id=r["path_id"], from_stage_id=r["from_stage_id"], to_type=r["to_type"], to_id=r["to_id"],
            required_exam_ids=split_ids(r["required_exam_ids"]), eligibility_summary=r["eligibility_summary"],
            duration_years=number(r["duration_years"]), advantages=text(r["advantages"]),
            limitations=text(r["limitations"]), verified=boolean(r["verified"]),
            source_url=text(r["source_url"]), last_verified=day(r["last_verified"]),
        ))
    for r in tables["career_paths.csv"]:
        objects.append(CareerPath(
            path_id=r["path_id"], from_career_id=r["from_career_id"], to_career_id=r["to_career_id"],
            transition_type=r["transition_type"], typical_years_experience=text(r["typical_years_experience"]),
            required_skill_ids=split_ids(r["required_skill_ids"]), notes=text(r["notes"]),
        ))
    for r in tables["career_transition_paths.csv"]:
        objects.append(CareerTransition(
            transition_id=r["transition_id"], from_type=r["from_type"], from_id=r["from_id"],
            to_career_id=r["to_career_id"], difficulty=r["difficulty"],
            estimated_months_min=integer(r["estimated_months_min"]),
            estimated_months_max=integer(r["estimated_months_max"]),
            required_skill_ids=split_ids(r["required_skill_ids"]),
            required_qualifications=text(r["required_qualifications"]),
            recommended_course_ids=split_ids(r["recommended_course_ids"]),
            recommended_certification_ids=split_ids(r["recommended_certification_ids"]),
            steps=split_ids(r["steps"]), notes=text(r["notes"]), source_url=text(r["source_url"]),
        ))
    for r in tables["interest_questions.csv"]:
        objects.append(InterestQuestion(
            question_id=r["question_id"], text=r["question_text"], riasec_type=r["riasec_type"],
            source=r["source"], license=r["license"],
        ))
    for r in tables["personality_questions.csv"]:
        objects.append(PersonalityQuestion(
            question_id=r["question_id"], text=r["question_text"], trait=r["trait"], keyed=r["keyed"],
            source=r["source"], license=r["license"],
        ))
    for r in tables["aptitude_questions.csv"]:
        objects.append(AptitudeQuestion(
            question_id=r["question_id"], category=r["category"], difficulty=r["difficulty"],
            text=r["question_text"], options={x: r[f"option_{x}"] for x in "abcd"},
            correct_option=r["correct_option"], explanation=text(r["explanation"]),
            source=r["source"], license=r["license"],
        ))
    return objects


def loaded_fingerprint(db: Session) -> str | None:
    row = db.get(CatalogMeta, "fingerprint")
    return row.value if row else None


def seed(db: Session, data_dir: Path = DATASETS_DIR, force: bool = False) -> dict:
    """Returns {"status": "loaded" | "unchanged", "counts": {...}}. Raises SeedError on invalid data."""
    data_dir = Path(data_dir)
    current = fingerprint(data_dir)
    if not force and loaded_fingerprint(db) == current:
        return {"status": "unchanged", "counts": {}}

    report, tables = validate(data_dir)
    if not report.ok:
        preview = "; ".join(report.errors[:5])
        raise SeedError(f"{len(report.errors)} dataset error(s), nothing was loaded: {preview}")

    objects = build_objects(tables)
    insert_order = list(reversed(DELETE_ORDER))  # parents first
    objects.sort(key=lambda obj: insert_order.index(type(obj)))
    try:
        for model in DELETE_ORDER:
            db.execute(delete(model))
        db.flush()
        # Insert table by table so every foreign key already exists
        for model in insert_order:
            db.add_all([obj for obj in objects if type(obj) is model])
            db.flush()
        db.merge(CatalogMeta(key="fingerprint", value=current))
        db.merge(CatalogMeta(key="loaded_on", value=date.today().isoformat()))
        db.commit()
    except Exception:
        db.rollback()  # old data stays exactly as it was
        raise

    counts = {model.__tablename__: db.query(model).count() for model in reversed(DELETE_ORDER)}
    logger.info("Catalog loaded: %s", counts)
    return {"status": "loaded", "counts": counts}


def auto_seed(db: Session) -> None:
    """Called on server start. Never crashes the server: bad data is logged
    and the previously loaded data keeps being served."""
    try:
        result = seed(db)
        if result["status"] == "loaded":
            logger.info("Reference data loaded from CSV files.")
    except SeedError as exc:
        logger.error("Reference data NOT updated: %s", exc)
    except Exception:
        logger.exception("Reference data loading failed; keeping previous data.")


def is_loaded(db: Session) -> bool:
    return db.scalar(select(Career.career_id).limit(1)) is not None


def main(argv: list[str]) -> int:
    from database import SessionLocal, init_db

    init_db()
    with SessionLocal() as db:
        try:
            result = seed(db, force="--force" in argv)
        except SeedError as exc:
            print(f"ERROR: {exc}")
            print("Run 'python -m catalog.validator' for the full list.")
            return 1
    if result["status"] == "unchanged":
        print("Datasets unchanged since last load. Use --force to reload.")
    else:
        for table, count in result["counts"].items():
            print(f"  {table:22} {count:>4} rows")
        print("Reference data loaded.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
