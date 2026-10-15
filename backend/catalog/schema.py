"""Rules for every dataset file in ../datasets.

Each FileSpec says which columns must exist, which must be filled,
which values are allowed, and which columns point to IDs in other files.
The validator (catalog/validator.py) checks all CSVs against these rules."""
from dataclasses import dataclass, field
from pathlib import Path

DATASETS_DIR = Path(__file__).resolve().parents[2] / "datasets"

# "course" = professional / skill courses (music, dance, design, acting, culinary, ...) that need no degree
LEVELS = {"school", "course", "diploma", "ug", "pg", "doctoral", "professional"}
PROFICIENCY = {"beginner", "intermediate", "advanced"}
RIASEC_TYPES = {"R", "I", "A", "S", "E", "C"}
BIG_FIVE = {"extraversion", "agreeableness", "conscientiousness", "emotional_stability", "openness"}
WORK_STYLE_TRAITS = {"leadership", "risk_tolerance", "team_orientation", "creativity", "research_orientation"}
PERSONALITY_TRAITS = BIG_FIVE | WORK_STYLE_TRAITS
APTITUDE_CATEGORIES = {"numerical", "logical", "verbal", "spatial", "problem_solving"}
INSTITUTION_TYPES = {"central", "state", "deemed", "private", "institute_of_national_importance"}

# Minimum questions per scale, so every score is based on enough answers
MIN_PER_RIASEC_TYPE = 4
MIN_PER_APTITUDE_CATEGORY = 5


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
                "exam_id", "exam_name", "full_name", "conducting_body", "exam_level", "exam_scope", "purpose",
                "eligible_stage_ids", "eligibility_summary", "age_limit_note", "frequency", "typical_month",
                "official_url", "verified", "last_verified",
            ),
            id_column="exam_id",
            id_prefix="EXM_",
            required=("exam_id", "exam_name", "full_name", "conducting_body", "exam_level", "exam_scope", "purpose",
                      "eligible_stage_ids", "eligibility_summary", "official_url", "verified", "last_verified"),
            enums={
                "exam_level": {"ug_admission", "pg_admission", "doctoral", "government_job", "other"},
                # Administrative reach of the exam / the post it recruits for
                "exam_scope": {"international", "national", "state", "district", "local"},
            },
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
        FileSpec(
            "interest_questions.csv",
            ("question_id", "question_text", "riasec_type", "response_scale", "source", "license"),
            id_column="question_id",
            id_prefix="IQ_",
            required=("question_id", "question_text", "riasec_type", "response_scale", "source", "license"),
            enums={"riasec_type": RIASEC_TYPES, "response_scale": {"1-5"}},
        ),
        FileSpec(
            "personality_questions.csv",
            ("question_id", "question_text", "trait", "keyed", "response_scale", "source", "license"),
            id_column="question_id",
            id_prefix="PQ_",
            required=("question_id", "question_text", "trait", "keyed", "response_scale", "source", "license"),
            enums={"trait": PERSONALITY_TRAITS, "keyed": {"+", "-"}, "response_scale": {"1-5"}},
        ),
        FileSpec(
            "aptitude_questions.csv",
            (
                "question_id", "category", "difficulty", "question_text", "option_a", "option_b", "option_c",
                "option_d", "correct_option", "explanation", "source", "license",
            ),
            id_column="question_id",
            id_prefix="AQ_",
            required=("question_id", "category", "difficulty", "question_text", "option_a", "option_b",
                      "option_c", "option_d", "correct_option", "source", "license"),
            enums={
                "category": APTITUDE_CATEGORIES,
                "difficulty": {"easy", "medium", "hard"},
                "correct_option": {"a", "b", "c", "d"},
            },
        ),
        FileSpec(
            "universities.csv",
            ("university_id", "university_name", "type", "state", "city", "ugc_recognized", "nirf_rank",
             "nirf_category", "nirf_year", "aishe_code", "official_url", "last_verified"),
            id_column="university_id",
            id_prefix="UNI_",
            required=("university_id", "university_name", "type", "state", "official_url", "last_verified"),
            enums={"type": INSTITUTION_TYPES},
            int_ranges={"nirf_rank": (1, 1000), "nirf_year": (2016, 2100)},
            booleans=("ugc_recognized",),
            dates=("last_verified",),
            urls=("official_url",),
        ),
        FileSpec(
            "colleges.csv",
            ("college_id", "college_name", "university_id", "type", "state", "city", "stage_ids_offered",
             "accepted_exam_ids", "approvals", "nirf_rank", "nirf_year", "fees_note", "aishe_code", "official_url",
             "last_verified"),
            id_column="college_id",
            id_prefix="COL_",
            required=("college_id", "college_name", "type", "state", "stage_ids_offered", "official_url",
                      "last_verified"),
            enums={"type": INSTITUTION_TYPES},
            foreign_keys={"university_id": "universities.csv", "stage_ids_offered": "education_stages.csv",
                          "accepted_exam_ids": "entrance_exams.csv"},
            int_ranges={"nirf_rank": (1, 1000), "nirf_year": (2016, 2100)},
            dates=("last_verified",),
            urls=("official_url",),
        ),
        FileSpec(
            "scholarships.csv",
            ("scholarship_id", "scholarship_name", "provider", "provider_type", "eligible_stage_ids",
             "eligibility_summary", "income_limit_note", "category_note", "gender_note", "state_restriction",
             "amount_note", "application_window_note", "official_url", "verified", "last_verified"),
            id_column="scholarship_id",
            id_prefix="SCH_",
            required=("scholarship_id", "scholarship_name", "provider", "provider_type", "eligible_stage_ids",
                      "eligibility_summary", "official_url", "verified", "last_verified"),
            enums={"provider_type": {"central_government", "state_government", "private", "university", "international"}},
            foreign_keys={"eligible_stage_ids": "education_stages.csv"},
            booleans=("verified",),
            dates=("last_verified",),
            urls=("official_url",),
        ),
        FileSpec(
            "courses.csv",
            ("course_id", "course_name", "provider", "platform", "url", "skill_ids", "level", "cost_type",
             "duration_hours", "language", "certificate_available", "last_verified"),
            id_column="course_id",
            id_prefix="CRS_",
            required=("course_id", "course_name", "provider", "url", "skill_ids", "level", "cost_type", "language",
                      "last_verified"),
            # freemium = free to learn, paid for a certificate or extra content
            enums={"level": PROFICIENCY, "cost_type": {"free", "freemium", "paid"}},
            foreign_keys={"skill_ids": "skills.csv"},
            numbers=("duration_hours",),
            booleans=("certificate_available",),
            dates=("last_verified",),
            urls=("url",),
        ),
        FileSpec(
            "certifications.csv",
            ("certification_id", "certification_name", "issuing_body", "url", "related_career_ids", "skill_ids",
             "level", "prerequisites", "cost_note", "validity_years", "last_verified"),
            id_column="certification_id",
            id_prefix="CRT_",
            required=("certification_id", "certification_name", "issuing_body", "url", "related_career_ids",
                      "skill_ids", "level", "cost_note", "last_verified"),
            enums={"level": {"foundation", "associate", "professional"}},
            foreign_keys={"related_career_ids": "careers.csv", "skill_ids": "skills.csv"},
            int_ranges={"validity_years": (1, 10)},
            dates=("last_verified",),
            urls=("url",),
        ),
        # Project briefs shown in the roadmap's "Prove it" stage; steps are pipe-separated checklist items
        FileSpec(
            "project_ideas.csv",
            ("project_id", "project_title", "career_ids", "level", "summary", "skill_ids", "steps", "deliverable",
             "estimated_hours"),
            id_column="project_id",
            id_prefix="PRJ_",
            required=("project_id", "project_title", "career_ids", "level", "summary", "skill_ids", "steps",
                      "deliverable", "estimated_hours"),
            enums={"level": PROFICIENCY},
            foreign_keys={"career_ids": "careers.csv", "skill_ids": "skills.csv"},
            int_ranges={"estimated_hours": (1, 200)},
        ),
        # Official pay only (government pay matrices and schemes), each row with its source; never estimated
        FileSpec(
            "salary_ranges.csv",
            ("salary_id", "career_id", "role_label", "sector", "pay_basis", "level", "monthly_min", "monthly_max",
             "range_note", "includes_note", "source_name", "source_url", "as_of", "last_verified"),
            id_column="salary_id",
            id_prefix="SAL_",
            required=("salary_id", "career_id", "role_label", "sector", "pay_basis", "monthly_min", "range_note",
                      "includes_note", "source_name", "source_url", "as_of", "last_verified"),
            enums={"sector": {"central_government", "state_government", "public_sector"},
                   "pay_basis": {"pay_level", "fixed_package"}},
            foreign_keys={"career_id": "careers.csv"},
            int_ranges={"monthly_min": (1000, 1000000), "monthly_max": (1000, 1000000)},
            dates=("as_of", "last_verified"),
            urls=("source_url",),
        ),
        # Hindi text for catalog entries (draft until reviewed by a native speaker); English is the fallback
        FileSpec(
            "fee_examples.csv",
            ("fee_id", "stage_ids", "institution", "institute_type", "band", "period", "amount", "includes_note",
             "excludes_note", "waiver_note", "source_name", "source_url", "as_of", "last_verified"),
            id_column="fee_id",
            id_prefix="FEE_",
            required=("fee_id", "stage_ids", "institution", "institute_type", "band", "period", "amount",
                      "includes_note", "source_name", "source_url", "as_of", "last_verified"),
            # Official fee figures only, copied from the institute's own fee notice (never estimated)
            enums={"institute_type": {"iit", "nit", "iiit", "gfti", "central", "state", "private"},
                   "band": {"income_above_5l", "income_1_to_5l", "income_below_1l", "sc_st_pwd", "all"},
                   "period": {"first_semester", "first_year", "per_year", "programme_total"}},
            foreign_keys={"stage_ids": "education_stages.csv"},
            int_ranges={"amount": (0, 10000000)},
            dates=("as_of", "last_verified"),
            urls=("source_url",),
        ),
        FileSpec(
            "translations_hi.csv",
            ("entity_type", "entity_id", "field", "text_hi", "status"),
            unique_together=("entity_type", "entity_id", "field"),
            required=("entity_type", "entity_id", "field", "text_hi", "status"),
            enums={"entity_type": {"career", "exam", "stage", "skill"}, "status": {"draft", "reviewed"},
                   "field": {"name", "description", "purpose"}},
        ),
        # Link to the official syllabus of an exam (page or PDF), with the section names read from it
        FileSpec(
            "exam_syllabus.csv",
            ("exam_id", "syllabus_url", "format", "sections", "last_verified"),
            id_column="exam_id",
            required=("exam_id", "syllabus_url", "format", "last_verified"),
            enums={"format": {"page", "pdf"}},
            foreign_keys={"exam_id": "entrance_exams.csv"},
            dates=("last_verified",),
            urls=("syllabus_url",),
        ),
        # Exact dates published by the exam organiser (only where officially announced)
        FileSpec(
            "exam_dates.csv",
            ("date_id", "exam_id", "event", "start_date", "end_date", "source_url", "last_verified"),
            id_column="date_id",
            id_prefix="ED_",
            required=("date_id", "exam_id", "event", "start_date", "end_date", "source_url", "last_verified"),
            enums={"event": {"registration_opens", "registration_closes", "late_registration_closes", "admit_card",
                              "exam", "result"}},
            foreign_keys={"exam_id": "entrance_exams.csv"},
            dates=("last_verified",),  # start/end may be in the future; format checked in validator.check_logic
            urls=("source_url",),
        ),
        # Published opening/closing ranks (JoSAA archive) for the college predictor
        FileSpec(
            "closing_ranks.csv",
            ("rank_id", "year", "round", "institute_name", "institute_type", "exam_id", "stage_id", "program_name",
             "quota", "seat_type", "gender", "opening_rank", "closing_rank", "source_url", "last_verified"),
            id_column="rank_id",
            id_prefix="CR_",
            required=("rank_id", "year", "round", "institute_name", "institute_type", "exam_id", "stage_id",
                      "program_name", "quota", "seat_type", "gender", "opening_rank", "closing_rank", "source_url",
                      "last_verified"),
            enums={"institute_type": {"iit", "nit", "iiit", "gfti"}, "quota": {"AI", "OS"},
                   "seat_type": {"OPEN", "EWS", "OBC-NCL", "SC", "ST"}, "gender": {"neutral", "female"}},
            foreign_keys={"exam_id": "entrance_exams.csv", "stage_id": "education_stages.csv"},
            int_ranges={"year": (2016, 2100), "round": (1, 10), "opening_rank": (1, 2000000), "closing_rank": (1, 2000000)},
            dates=("last_verified",),
            urls=("source_url",),
        ),
    ]
}
# Header-only files kept for a possible later use. Only their header is checked.
# career_roadmaps.csv: roadmaps are generated from the skill mapping, education paths
# and courses (engine/roadmap.py), so hand-written stages are not needed today.
PLANNED_FILES: dict[str, str] = {
    "career_roadmaps.csv": "roadmap_id",
}

# Which ID column each file exposes for foreign keys
ID_COLUMNS: dict[str, str] = {
    **{name: spec.id_column for name, spec in SPECS.items() if spec.id_column},
    **PLANNED_FILES,
}
