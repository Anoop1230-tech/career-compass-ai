"""Response shapes for the read-only catalog API."""
from datetime import date

from pydantic import BaseModel, ConfigDict


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class StageOut(ORM):
    stage_id: str
    name: str
    level: str
    stream_or_branch: str | None
    typical_duration_years: float | None
    description: str | None


class SkillOut(ORM):
    skill_id: str
    name: str
    category: str
    sub_category: str | None
    aliases: list[str]
    description: str | None


class CareerSummary(ORM):
    career_id: str
    name: str
    domain: str
    sub_domain: str | None
    description: str
    min_education_level: str


class CareerList(BaseModel):
    total: int
    items: list[CareerSummary]
    domains: list[str]  # all domains, for the filter dropdown


class CareerSkillOut(BaseModel):
    skill_id: str
    name: str
    category: str
    importance: int
    proficiency_required: str
    is_mandatory: bool


class ExamSummary(ORM):
    exam_id: str
    name: str
    full_name: str
    official_url: str
    verified: bool


class EntryPath(BaseModel):
    """How someone reaches this career from an education stage."""

    path_id: str
    from_stage_id: str
    from_stage_name: str
    required_exams: list[ExamSummary]
    eligibility_summary: str
    advantages: str | None
    limitations: str | None
    verified: bool
    source_url: str | None


class CareerLink(BaseModel):
    """A related career: next move from here, or previous role leading here."""

    career_id: str
    name: str
    transition_type: str
    typical_years_experience: str | None
    notes: str | None


class TransitionOut(BaseModel):
    transition_id: str
    from_type: str
    from_id: str
    from_name: str
    difficulty: str
    estimated_months_min: int | None
    estimated_months_max: int | None
    required_skills: list[str]
    required_qualifications: str | None
    steps: list[str]
    notes: str | None


class CareerDetail(ORM):
    career_id: str
    name: str
    domain: str
    sub_domain: str | None
    description: str
    min_education_level: str
    typical_stages: list[StageOut]
    riasec_codes: list[str]
    key_aptitudes: list[str]
    personality_fit: list[str]
    work_style: list[str]
    salary_note: str | None
    onet_code: str | None
    source_url: str
    last_verified: date
    skills: list[CareerSkillOut]
    entry_paths: list[EntryPath]
    next_careers: list[CareerLink]
    previous_careers: list[CareerLink]
    transitions_in: list[TransitionOut]


class ExamOut(ORM):
    exam_id: str
    name: str
    full_name: str
    conducting_body: str
    exam_level: str
    purpose: str
    eligible_stage_ids: list[str]
    eligibility_summary: str
    age_limit_note: str | None
    frequency: str | None
    typical_month: str | None
    official_url: str
    verified: bool
    last_verified: date
