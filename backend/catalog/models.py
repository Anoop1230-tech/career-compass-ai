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
