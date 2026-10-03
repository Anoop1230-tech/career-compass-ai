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
    Certification,
    College,
    Course,
    EducationPath,
    Exam,
    InterestQuestion,
    PersonalityQuestion,
    ProjectIdea,
    SalaryRange,
    ExamDate,
    Translation,
    ClosingRank,
    Scholarship,
    Skill,
    Stage,
    University,
)
from catalog.schema import DATASETS_DIR, PLANNED_FILES, SPECS
from catalog.validator import split_ids, validate

logger = logging.getLogger("career_compass.seed")

# Delete children before parents (foreign keys)
DELETE_ORDER = [
    SalaryRange, ClosingRank, ExamDate, Translation, CareerSkill, EducationPath, CareerPath, CareerTransition, Exam, Career, Skill, Stage,
    InterestQuestion, PersonalityQuestion, AptitudeQuestion, College, Scholarship, University,
    Course, Certification, ProjectIdea,
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
    for r in tables["universities.csv"]:
        objects.append(University(
            university_id=r["university_id"], name=r["university_name"], type=r["type"], state=r["state"],
            city=text(r["city"]), ugc_recognized=boolean(r["ugc_recognized"]) if r["ugc_recognized"] else None,
            nirf_rank=integer(r["nirf_rank"]), nirf_category=text(r["nirf_category"]), nirf_year=integer(r["nirf_year"]),
            official_url=r["official_url"], last_verified=day(r["last_verified"]),
        ))
    for r in tables["colleges.csv"]:
        objects.append(College(
            college_id=r["college_id"], name=r["college_name"], university_id=text(r["university_id"]),
            type=r["type"], state=r["state"], city=text(r["city"]),
            stage_ids_offered=split_ids(r["stage_ids_offered"]), accepted_exam_ids=split_ids(r["accepted_exam_ids"]),
            approvals=split_ids(r["approvals"]), nirf_rank=integer(r["nirf_rank"]), nirf_year=integer(r["nirf_year"]),
            fees_note=text(r["fees_note"]), official_url=r["official_url"], last_verified=day(r["last_verified"]),
        ))
    for r in tables["scholarships.csv"]:
        objects.append(Scholarship(
            scholarship_id=r["scholarship_id"], name=r["scholarship_name"], provider=r["provider"],
            provider_type=r["provider_type"], eligible_stage_ids=split_ids(r["eligible_stage_ids"]),
            eligibility_summary=r["eligibility_summary"], income_limit_note=text(r["income_limit_note"]),
            category_note=text(r["category_note"]), gender_note=text(r["gender_note"]),
            state_restriction=text(r["state_restriction"]), amount_note=text(r["amount_note"]),
            application_window_note=text(r["application_window_note"]), official_url=r["official_url"],
            verified=boolean(r["verified"]), last_verified=day(r["last_verified"]),
        ))
    for r in tables["courses.csv"]:
        objects.append(Course(
            course_id=r["course_id"], name=r["course_name"], provider=r["provider"], platform=text(r["platform"]),
            url=r["url"], skill_ids=split_ids(r["skill_ids"]), level=r["level"], cost_type=r["cost_type"],
            duration_hours=number(r["duration_hours"]), language=r["language"],
            certificate_available=boolean(r["certificate_available"]) if r["certificate_available"] else None,
            last_verified=day(r["last_verified"]),
        ))
    for r in tables["certifications.csv"]:
        objects.append(Certification(
            certification_id=r["certification_id"], name=r["certification_name"], issuing_body=r["issuing_body"],
            url=r["url"], related_career_ids=split_ids(r["related_career_ids"]), skill_ids=split_ids(r["skill_ids"]),
            level=r["level"], prerequisites=text(r["prerequisites"]), cost_note=r["cost_note"],
            validity_years=integer(r["validity_years"]), last_verified=day(r["last_verified"]),
        ))
    for r in tables["salary_ranges.csv"]:
        objects.append(SalaryRange(
            salary_id=r["salary_id"], career_id=r["career_id"], role_label=r["role_label"], sector=r["sector"],
            pay_basis=r["pay_basis"], level=text(r["level"]), monthly_min=integer(r["monthly_min"]),
            monthly_max=integer(r["monthly_max"]), range_note=r["range_note"], includes_note=r["includes_note"],
            source_name=r["source_name"], source_url=r["source_url"], as_of=day(r["as_of"]),
            last_verified=day(r["last_verified"]),
        ))
    for r in tables["translations_hi.csv"]:
        objects.append(Translation(entity_type=r["entity_type"], entity_id=r["entity_id"], field=r["field"], lang="hi",
                                   text=r["text_hi"], status=r["status"]))
    for r in tables["exam_dates.csv"]:
        objects.append(ExamDate(
            date_id=r["date_id"], exam_id=r["exam_id"], event=r["event"], start_date=day(r["start_date"]),
            end_date=day(r["end_date"]), source_url=r["source_url"], last_verified=day(r["last_verified"]),
        ))
    for r in tables["closing_ranks.csv"]:
        objects.append(ClosingRank(
            rank_id=r["rank_id"], year=integer(r["year"]), round=integer(r["round"]), institute_name=r["institute_name"],
            institute_type=r["institute_type"], exam_id=r["exam_id"], stage_id=r["stage_id"], program_name=r["program_name"],
            quota=r["quota"], seat_type=r["seat_type"], gender=r["gender"], opening_rank=integer(r["opening_rank"]),
            closing_rank=integer(r["closing_rank"]), source_url=r["source_url"], last_verified=day(r["last_verified"]),
        ))
    for r in tables["project_ideas.csv"]:
        objects.append(ProjectIdea(
            project_id=r["project_id"], title=r["project_title"], career_ids=split_ids(r["career_ids"]),
            level=r["level"], summary=r["summary"], skill_ids=split_ids(r["skill_ids"]), steps=split_ids(r["steps"]),
            deliverable=r["deliverable"], estimated_hours=integer(r["estimated_hours"]),
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
