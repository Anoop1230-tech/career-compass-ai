"""Rules for every dataset file in ../datasets.

Each FileSpec says which columns must exist, which must be filled,
which values are allowed, and which columns point to IDs in other files.
The validator (catalog/validator.py) checks all CSVs against these rules."""
from dataclasses import dataclass, field
from pathlib import Path

DATASETS_DIR = Path(__file__).resolve().parents[2] / "datasets"

LEVELS = {"school", "diploma", "ug", "pg", "doctoral", "professional"}
PROFICIENCY = {"beginner", "intermediate", "advanced"}


@dataclass(frozen=True)
class FileSpec:
    name: str  # file name, e.g. "careers.csv"
    columns: tuple[str, ...]  # exact header, in order
    id_column: str | None = None  # must be unique; None = composite key
    unique_together: tuple[str, ...] = ()
    required: tuple[str, ...] = ()  # must not be empty
    enums: dict[str, set[str]] = field(default_factory=dict)
    # column -> target file; value may be one ID or pipe-separated IDs
    foreign_keys: dict[str, str] = field(default_factory=dict)
    int_ranges: dict[str, tuple[int, int]] = field(default_factory=dict)
    numbers: tuple[str, ...] = ()  # non-negative numbers (int or decimal)
    booleans: tuple[str, ...] = ()
    dates: tuple[str, ...] = ()
    urls: tuple[str, ...] = ()
    id_prefix: str | None = None


SPECS: dict[str, FileSpec] = {
    spec.name: spec
    for spec in [
        FileSpec(
            "education_stages.csv",
            ("stage_id", "stage_name", "level", "stream_or_branch", "typical_duration_years", "description"),
            id_column="stage_id",
            id_prefix="EDU_",
            required=("stage_id", "stage_name", "level"),
            enums={"level": LEVELS},
            numbers=("typical_duration_years",),
        ),
        FileSpec(
            "skills.csv",
            ("skill_id", "skill_name", "category", "sub_category", "aliases", "description"),
            id_column="skill_id",
            id_prefix="SKL_",
            required=("skill_id", "skill_name", "category"),
            enums={"category": {"programming", "technical", "math", "soft", "management", "domain"}},
        ),
        FileSpec(
            "careers.csv",
            (
                "career_id", "career_name", "domain", "sub_domain", "description", "min_education_level",
                "typical_education_stage_ids", "riasec_codes", "key_aptitudes", "personality_fit", "work_style",
                "salary_note", "onet_code", "esco_uri", "source_url", "last_verified",
            ),
            id_column="career_id",
            id_prefix="CAR_",
            required=("career_id", "career_name", "domain", "description", "min_education_level",
                      "riasec_codes", "key_aptitudes", "source_url", "last_verified"),
            enums={
                "min_education_level": LEVELS,
                "riasec_codes": {"R", "I", "A", "S", "E", "C"},
                "key_aptitudes": {"logical", "numerical", "verbal", "spatial", "problem_solving"},
                "personality_fit": {"research", "team", "leadership", "creative", "risk_tolerant"},
                "work_style": {"office", "field", "lab", "remote_friendly", "campus"},
            },
            foreign_keys={"typical_education_stage_ids": "education_stages.csv"},
            dates=("last_verified",),
            urls=("source_url", "esco_uri"),
        ),
        FileSpec(
            "skill_career_mapping.csv",
            ("career_id", "skill_id", "importance", "proficiency_required", "is_mandatory", "source"),
            unique_together=("career_id", "skill_id"),
            required=("career_id", "skill_id", "importance", "proficiency_required", "is_mandatory"),
            enums={"proficiency_required": PROFICIENCY},
            foreign_keys={"career_id": "careers.csv", "skill_id": "skills.csv"},
            int_ranges={"importance": (1, 5)},
            booleans=("is_mandatory",),
        ),
        FileSpec(
            "entrance_exams.csv",
            (
                "exam_id", "exam_name", "full_name", "conducting_body", "exam_level", "purpose",
                "eligible_stage_ids", "eligibility_summary", "age_limit_note", "frequency", "typical_month",
                "official_url", "verified", "last_verified",
            ),
            id_column="exam_id",
            id_prefix="EXM_",
            required=("exam_id", "exam_name", "full_name", "conducting_body", "exam_level", "purpose",
                      "eligible_stage_ids", "eligibility_summary", "official_url", "verified", "last_verified"),
            enums={"exam_level": {"ug_admission", "pg_admission", "doctoral", "government_job", "other"}},
            foreign_keys={"eligible_stage_ids": "education_stages.csv"},
            booleans=("verified",),
            dates=("last_verified",),
            urls=("official_url",),
        ),
        FileSpec(
            "education_paths.csv",
            (
                "path_id", "from_stage_id", "to_type", "to_id", "required_exam_ids", "eligibility_summary",
                "duration_years", "advantages", "limitations", "verified", "source_url", "last_verified",
            ),
            id_column="path_id",
            id_prefix="EP_",
            required=("path_id", "from_stage_id", "to_type", "to_id", "eligibility_summary", "verified",
                      "last_verified"),
            enums={"to_type": {"education", "career", "exam"}},
            # to_id depends on to_type: checked separately in the validator
            foreign_keys={"from_stage_id": "education_stages.csv", "required_exam_ids": "entrance_exams.csv"},
            numbers=("duration_years",),
            booleans=("verified",),
            dates=("last_verified",),
            urls=("source_url",),
        ),
        FileSpec(
            "career_paths.csv",
            ("path_id", "from_career_id", "to_career_id", "transition_type", "typical_years_experience",
             "required_skill_ids", "notes"),
            id_column="path_id",
            id_prefix="CP_",
            required=("path_id", "from_career_id", "to_career_id", "transition_type"),
            enums={"transition_type": {"promotion", "specialization", "lateral", "management"}},
            foreign_keys={"from_career_id": "careers.csv", "to_career_id": "careers.csv",
                          "required_skill_ids": "skills.csv"},
        ),
        FileSpec(
            "career_transition_paths.csv",
            (
                "transition_id", "from_type", "from_id", "to_career_id", "difficulty", "estimated_months_min",
                "estimated_months_max", "required_skill_ids", "required_qualifications", "recommended_course_ids",
                "recommended_certification_ids", "steps", "notes", "source_url",
            ),
            id_column="transition_id",
            id_prefix="TR_",
            required=("transition_id", "from_type", "from_id", "to_career_id", "difficulty", "steps"),
            enums={"from_type": {"education", "career"}, "difficulty": {"low", "medium", "high"}},
            # from_id depends on from_type: checked separately
            foreign_keys={"to_career_id": "careers.csv", "required_skill_ids": "skills.csv",
                          "recommended_course_ids": "courses.csv",
                          "recommended_certification_ids": "certifications.csv"},
            int_ranges={"estimated_months_min": (0, 120), "estimated_months_max": (0, 120)},
            urls=("source_url",),
        ),
    ]
}

# Header-only files still being filled in later phases. Only their header is checked.
PLANNED_FILES: dict[str, str] = {
    "career_roadmaps.csv": "roadmap_id",
    "courses.csv": "course_id",
    "certifications.csv": "certification_id",
    "universities.csv": "university_id",
    "colleges.csv": "college_id",
    "scholarships.csv": "scholarship_id",
    "interest_questions.csv": "question_id",
    "personality_questions.csv": "question_id",
    "aptitude_questions.csv": "question_id",
}

# Which ID column each file exposes for foreign keys
ID_COLUMNS: dict[str, str] = {
    **{name: spec.id_column for name, spec in SPECS.items() if spec.id_column},
    **PLANNED_FILES,
}
