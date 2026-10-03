"""Database tables for the career and education reference data.

These tables are filled from ../datasets/*.csv by catalog/seed.py and are
read-only for the app. Lists (e.g. "EDU_BTECH_CSE|EDU_BCA") are stored as
JSON arrays so the API can return them directly."""
from datetime import date

from sqlalchemy import JSON, Boolean, Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Stage(Base):
    __tablename__ = "stages"

    stage_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    level: Mapped[str] = mapped_column(String(20), index=True)
    stream_or_branch: Mapped[str | None] = mapped_column(String(120))
    typical_duration_years: Mapped[float | None] = mapped_column(Float)
    description: Mapped[str | None] = mapped_column(Text)


class Skill(Base):
    __tablename__ = "skills"

    skill_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), index=True)
    category: Mapped[str] = mapped_column(String(20), index=True)
    sub_category: Mapped[str | None] = mapped_column(String(60))
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    description: Mapped[str | None] = mapped_column(Text)


class Career(Base):
    __tablename__ = "careers"

    career_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    domain: Mapped[str] = mapped_column(String(60), index=True)
    sub_domain: Mapped[str | None] = mapped_column(String(60))
    description: Mapped[str] = mapped_column(Text)
    min_education_level: Mapped[str] = mapped_column(String(20))
    typical_stage_ids: Mapped[list] = mapped_column(JSON, default=list)
    riasec_codes: Mapped[list] = mapped_column(JSON, default=list)
    key_aptitudes: Mapped[list] = mapped_column(JSON, default=list)
    personality_fit: Mapped[list] = mapped_column(JSON, default=list)
    work_style: Mapped[list] = mapped_column(JSON, default=list)
    salary_note: Mapped[str | None] = mapped_column(Text)
    onet_code: Mapped[str | None] = mapped_column(String(20))
    esco_uri: Mapped[str | None] = mapped_column(String(300))
    source_url: Mapped[str] = mapped_column(String(300))
    last_verified: Mapped[date] = mapped_column(Date)

    skill_links: Mapped[list["CareerSkill"]] = relationship(
        back_populates="career", cascade="all, delete-orphan", order_by="CareerSkill.importance.desc()"
    )


class CareerSkill(Base):
    __tablename__ = "career_skills"

    career_id: Mapped[str] = mapped_column(ForeignKey("careers.career_id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.skill_id", ondelete="CASCADE"), primary_key=True)
    importance: Mapped[int] = mapped_column(Integer)
    proficiency_required: Mapped[str] = mapped_column(String(20))
    is_mandatory: Mapped[bool] = mapped_column(Boolean)
    source: Mapped[str | None] = mapped_column(String(60))

    career: Mapped[Career] = relationship(back_populates="skill_links")
    skill: Mapped[Skill] = relationship()


class Exam(Base):
    __tablename__ = "exams"

    exam_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    conducting_body: Mapped[str] = mapped_column(String(200))
    exam_level: Mapped[str] = mapped_column(String(30), index=True)
    purpose: Mapped[str] = mapped_column(Text)
    eligible_stage_ids: Mapped[list] = mapped_column(JSON, default=list)
    eligibility_summary: Mapped[str] = mapped_column(Text)
    age_limit_note: Mapped[str | None] = mapped_column(Text)
    frequency: Mapped[str | None] = mapped_column(String(80))
    typical_month: Mapped[str | None] = mapped_column(String(120))
    official_url: Mapped[str] = mapped_column(String(300))
    verified: Mapped[bool] = mapped_column(Boolean)
    last_verified: Mapped[date] = mapped_column(Date)


class EducationPath(Base):
    """Edge from an education stage to a stage, career or exam."""

    __tablename__ = "education_paths"

    path_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    from_stage_id: Mapped[str] = mapped_column(ForeignKey("stages.stage_id", ondelete="CASCADE"), index=True)
    to_type: Mapped[str] = mapped_column(String(20))
    to_id: Mapped[str] = mapped_column(String(40), index=True)
    required_exam_ids: Mapped[list] = mapped_column(JSON, default=list)
    eligibility_summary: Mapped[str] = mapped_column(Text)
    duration_years: Mapped[float | None] = mapped_column(Float)
    advantages: Mapped[str | None] = mapped_column(Text)
    limitations: Mapped[str | None] = mapped_column(Text)
    verified: Mapped[bool] = mapped_column(Boolean)
    source_url: Mapped[str | None] = mapped_column(String(300))
    last_verified: Mapped[date] = mapped_column(Date)


class CareerPath(Base):
    """Progression from one career to another within a working life."""

    __tablename__ = "career_paths"

    path_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    from_career_id: Mapped[str] = mapped_column(ForeignKey("careers.career_id", ondelete="CASCADE"), index=True)
    to_career_id: Mapped[str] = mapped_column(ForeignKey("careers.career_id", ondelete="CASCADE"), index=True)
    transition_type: Mapped[str] = mapped_column(String(20))
    typical_years_experience: Mapped[str | None] = mapped_column(String(20))
    required_skill_ids: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[str | None] = mapped_column(Text)


class CareerTransition(Base):
    """'I am X, can I become Y?' switch from a stage or career."""

    __tablename__ = "career_transitions"

    transition_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    from_type: Mapped[str] = mapped_column(String(20))
    from_id: Mapped[str] = mapped_column(String(40), index=True)
    to_career_id: Mapped[str] = mapped_column(ForeignKey("careers.career_id", ondelete="CASCADE"), index=True)
    difficulty: Mapped[str] = mapped_column(String(10))
    estimated_months_min: Mapped[int | None] = mapped_column(Integer)
    estimated_months_max: Mapped[int | None] = mapped_column(Integer)
    required_skill_ids: Mapped[list] = mapped_column(JSON, default=list)
    required_qualifications: Mapped[str | None] = mapped_column(Text)
    recommended_course_ids: Mapped[list] = mapped_column(JSON, default=list)
    recommended_certification_ids: Mapped[list] = mapped_column(JSON, default=list)
    steps: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(String(300))


class CatalogMeta(Base):
    """Key/value store: remembers which version of the CSVs is loaded."""

    __tablename__ = "catalog_meta"

    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    value: Mapped[str] = mapped_column(Text)



# ---------------------------------------------------------------- question banks
class InterestQuestion(Base):
    __tablename__ = "interest_questions"

    question_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    text: Mapped[str] = mapped_column(Text)
    riasec_type: Mapped[str] = mapped_column(String(1), index=True)
    source: Mapped[str] = mapped_column(String(200))
    license: Mapped[str] = mapped_column(String(100))


class PersonalityQuestion(Base):
    __tablename__ = "personality_questions"

    question_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    text: Mapped[str] = mapped_column(Text)
    trait: Mapped[str] = mapped_column(String(30), index=True)
    keyed: Mapped[str] = mapped_column(String(1))  # "+" normal, "-" reverse-scored
    source: Mapped[str] = mapped_column(String(200))
    license: Mapped[str] = mapped_column(String(100))


class AptitudeQuestion(Base):
    """correct_option and explanation are NEVER sent to the browser before submission."""

    __tablename__ = "aptitude_questions"

    question_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    category: Mapped[str] = mapped_column(String(30), index=True)
    difficulty: Mapped[str] = mapped_column(String(10))
    text: Mapped[str] = mapped_column(Text)
    options: Mapped[dict] = mapped_column(JSON)  # {"a": "...", "b": "...", "c": "...", "d": "..."}
    correct_option: Mapped[str] = mapped_column(String(1))
    explanation: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(200))
    license: Mapped[str] = mapped_column(String(100))


# ---------------------------------------------------------------- institutions and scholarships
class University(Base):
    __tablename__ = "universities"

    university_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    type: Mapped[str] = mapped_column(String(40))
    state: Mapped[str] = mapped_column(String(60), index=True)
    city: Mapped[str | None] = mapped_column(String(80))
    ugc_recognized: Mapped[bool | None] = mapped_column(Boolean)
    nirf_rank: Mapped[int | None] = mapped_column(Integer)
    nirf_category: Mapped[str | None] = mapped_column(String(60))
    nirf_year: Mapped[int | None] = mapped_column(Integer)
    official_url: Mapped[str] = mapped_column(String(300))
    last_verified: Mapped[date] = mapped_column(Date)


class College(Base):
    __tablename__ = "colleges"

    college_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    university_id: Mapped[str | None] = mapped_column(ForeignKey("universities.university_id", ondelete="SET NULL"))
    type: Mapped[str] = mapped_column(String(40))
    state: Mapped[str] = mapped_column(String(60), index=True)
    city: Mapped[str | None] = mapped_column(String(80))
    stage_ids_offered: Mapped[list] = mapped_column(JSON, default=list)
    accepted_exam_ids: Mapped[list] = mapped_column(JSON, default=list)
    approvals: Mapped[list] = mapped_column(JSON, default=list)
    nirf_rank: Mapped[int | None] = mapped_column(Integer)
    nirf_year: Mapped[int | None] = mapped_column(Integer)
    fees_note: Mapped[str | None] = mapped_column(Text)
    official_url: Mapped[str] = mapped_column(String(300))
    last_verified: Mapped[date] = mapped_column(Date)


class Scholarship(Base):
    __tablename__ = "scholarships"

    scholarship_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    provider: Mapped[str] = mapped_column(String(200))
    provider_type: Mapped[str] = mapped_column(String(40))
    eligible_stage_ids: Mapped[list] = mapped_column(JSON, default=list)
    eligibility_summary: Mapped[str] = mapped_column(Text)
    income_limit_note: Mapped[str | None] = mapped_column(Text)
    category_note: Mapped[str | None] = mapped_column(Text)
    gender_note: Mapped[str | None] = mapped_column(Text)
    state_restriction: Mapped[str | None] = mapped_column(String(80))
    amount_note: Mapped[str | None] = mapped_column(Text)
    application_window_note: Mapped[str | None] = mapped_column(Text)
    official_url: Mapped[str] = mapped_column(String(300))
    verified: Mapped[bool] = mapped_column(Boolean)
    last_verified: Mapped[date] = mapped_column(Date)


# ---------------------------------------------------------------- learning resources
class Course(Base):
    """A course or tutorial that teaches one or more skills (linked from roadmap steps)."""

    __tablename__ = "courses"

    course_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    provider: Mapped[str] = mapped_column(String(200))
    platform: Mapped[str | None] = mapped_column(String(100))
    url: Mapped[str] = mapped_column(String(300))
    skill_ids: Mapped[list] = mapped_column(JSON, default=list)
    level: Mapped[str] = mapped_column(String(20))
    cost_type: Mapped[str] = mapped_column(String(20))  # free | freemium | paid
    duration_hours: Mapped[float | None] = mapped_column(Float)
    language: Mapped[str] = mapped_column(String(60))
    certificate_available: Mapped[bool | None] = mapped_column(Boolean)
    last_verified: Mapped[date] = mapped_column(Date)


class Certification(Base):
    """An industry or professional certification relevant to some careers."""

    __tablename__ = "certifications"

    certification_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    issuing_body: Mapped[str] = mapped_column(String(200))
    url: Mapped[str] = mapped_column(String(300))
    related_career_ids: Mapped[list] = mapped_column(JSON, default=list)
    skill_ids: Mapped[list] = mapped_column(JSON, default=list)
    level: Mapped[str] = mapped_column(String(20))  # foundation | associate | professional
    prerequisites: Mapped[str | None] = mapped_column(Text)
    cost_note: Mapped[str] = mapped_column(Text)
    validity_years: Mapped[int | None] = mapped_column(Integer)
    last_verified: Mapped[date] = mapped_column(Date)


class SalaryRange(Base):
    """Official pay for one role in a career (government pay level or scheme), with its source."""

    __tablename__ = "salary_ranges"

    salary_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    career_id: Mapped[str] = mapped_column(ForeignKey("careers.career_id", ondelete="CASCADE"), index=True)
    role_label: Mapped[str] = mapped_column(String(200))
    sector: Mapped[str] = mapped_column(String(30))
    pay_basis: Mapped[str] = mapped_column(String(20))
    level: Mapped[str | None] = mapped_column(String(60))
    monthly_min: Mapped[int] = mapped_column(Integer)
    monthly_max: Mapped[int | None] = mapped_column(Integer)
    range_note: Mapped[str] = mapped_column(Text)
    includes_note: Mapped[str] = mapped_column(Text)
    source_name: Mapped[str] = mapped_column(String(200))
    source_url: Mapped[str] = mapped_column(String(300))
    as_of: Mapped[date] = mapped_column(Date)
    last_verified: Mapped[date] = mapped_column(Date)


class Translation(Base):
    """Hindi text for one field of a catalog entry (status "draft" until a native speaker reviews it)."""

    __tablename__ = "translations"

    entity_type: Mapped[str] = mapped_column(String(20), primary_key=True)
    entity_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    field: Mapped[str] = mapped_column(String(20), primary_key=True)
    lang: Mapped[str] = mapped_column(String(5), primary_key=True, default="hi")
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), default="draft")


class ExamDate(Base):
    """An exact date published by the exam organiser (registration, admit card, exam, result)."""

    __tablename__ = "exam_dates"

    date_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.exam_id"), index=True)
    event: Mapped[str] = mapped_column(String(30))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    source_url: Mapped[str] = mapped_column(String(300))
    last_verified: Mapped[date] = mapped_column(Date)


class ClosingRank(Base):
    """Published opening and closing rank of one programme, seat type and gender in one counselling round."""

    __tablename__ = "closing_ranks"

    rank_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    year: Mapped[int] = mapped_column(Integer)
    round: Mapped[int] = mapped_column(Integer)
    institute_name: Mapped[str] = mapped_column(String(200))
    institute_type: Mapped[str] = mapped_column(String(10))
    exam_id: Mapped[str] = mapped_column(String(40), index=True)
    stage_id: Mapped[str] = mapped_column(String(40), index=True)
    program_name: Mapped[str] = mapped_column(String(200))
    quota: Mapped[str] = mapped_column(String(5))
    seat_type: Mapped[str] = mapped_column(String(10))
    gender: Mapped[str] = mapped_column(String(10))
    opening_rank: Mapped[int] = mapped_column(Integer)
    closing_rank: Mapped[int] = mapped_column(Integer)
    source_url: Mapped[str] = mapped_column(String(300))
    last_verified: Mapped[date] = mapped_column(Date)


class ProjectIdea(Base):
    """A portfolio project brief with a step checklist, linked to one or more careers."""

    __tablename__ = "project_ideas"

    project_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    career_ids: Mapped[list] = mapped_column(JSON, default=list)
    level: Mapped[str] = mapped_column(String(20))
    summary: Mapped[str] = mapped_column(Text)
    skill_ids: Mapped[list] = mapped_column(JSON, default=list)
    steps: Mapped[list] = mapped_column(JSON, default=list)
    deliverable: Mapped[str] = mapped_column(Text)
    estimated_hours: Mapped[int] = mapped_column(Integer)
