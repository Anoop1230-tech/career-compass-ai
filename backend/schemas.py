"""Pydantic schemas: the exact shape and rules for data going in and out
of the API. Anything that breaks these rules is rejected with HTTP 422
before it can reach the database."""
from datetime import date, datetime
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    HttpUrl,
    StringConstraints,
    field_validator,
    model_validator,
)

import profile_options as opt

# Reusable string types: whitespace is trimmed automatically
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
MediumText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
Rating = Annotated[int, Field(ge=1, le=5)]

CURRENT_YEAR = date.today().year


class StrictModel(BaseModel):
    """Rejects unknown fields so typos are caught instead of silently ignored."""

    model_config = ConfigDict(extra="forbid")


def _check_choice(value, allowed: set[str], field: str):
    if value is not None and value not in allowed:
        raise ValueError(f"Invalid {field}: '{value}'")
    return value


def _check_choice_list(values: list[str], allowed: set[str], field: str) -> list[str]:
    unique = list(dict.fromkeys(values))  # remove duplicates, keep order
    for value in unique:
        _check_choice(value, allowed, field)
    return unique


# ---------------------------------------------------------------- auth
def _check_password_strength(value: str) -> str:
    if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
        raise ValueError("Password must contain at least one letter and one number")
    return value


NewPassword = Annotated[str, Field(min_length=8, max_length=128)]


class RegisterRequest(StrictModel):
    email: EmailStr
    password: NewPassword

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return _check_password_strength(value)


class ChangePasswordRequest(StrictModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: NewPassword

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return _check_password_strength(value)


class PasswordResetRequest(StrictModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class PasswordResetConfirm(StrictModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: NewPassword

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return _check_password_strength(value)


class LoginRequest(StrictModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    created_at: datetime
    has_profile: bool = False


# ------------------------------------------------------------- profile
class Education(StrictModel):
    degree: ShortText | None = None  # "B.Tech", "BCA", "MBA"
    branch: ShortText | None = None  # "Computer Science"
    stream: str | None = None  # school streams only
    institution: ShortText | None = None
    year_of_study: int | None = Field(default=None, ge=1, le=8)
    graduation_year: int | None = Field(default=None, ge=1950, le=CURRENT_YEAR + 10)
    score_type: str | None = None
    score: float | None = Field(default=None, ge=0)

    @field_validator("stream")
    @classmethod
    def valid_stream(cls, value):
        return _check_choice(value, opt.keys(opt.STREAMS), "stream")

    @field_validator("score_type")
    @classmethod
    def valid_score_type(cls, value):
        return _check_choice(value, opt.keys(opt.SCORE_TYPES), "score type")

    @model_validator(mode="after")
    def score_in_range(self):
        limits = {"percentage": 100, "cgpa_10": 10, "cgpa_4": 4, "grade": 100}
        if self.score is not None:
            if self.score_type is None:
                raise ValueError("Choose a score type for your academic score")
            if self.score > limits[self.score_type]:
                raise ValueError(f"Score cannot be more than {limits[self.score_type]} for this score type")
        return self


class Skill(StrictModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    category: str = "other"
    level: str = "beginner"

    @field_validator("category")
    @classmethod
    def valid_category(cls, value):
        return _check_choice(value, opt.keys(opt.SKILL_CATEGORIES), "skill category")

    @field_validator("level")
    @classmethod
    def valid_level(cls, value):
        return _check_choice(value, opt.keys(opt.SKILL_LEVELS), "skill level")


class Certification(StrictModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    issuer: ShortText | None = None
    year: int | None = Field(default=None, ge=1950, le=CURRENT_YEAR + 1)


class ExperienceItem(StrictModel):
    """An internship or a job."""

    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    organization: ShortText | None = None
    duration_months: int | None = Field(default=None, ge=0, le=600)
    description: MediumText | None = None


class Project(StrictModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    description: MediumText | None = None
    technologies: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]] = Field(
        default_factory=list, max_length=20
    )
    link: HttpUrl | None = None


class Experience(StrictModel):
    total_years: float | None = Field(default=None, ge=0, le=60)
    current_role: ShortText | None = None
    internships: list[ExperienceItem] = Field(default_factory=list, max_length=20)
    jobs: list[ExperienceItem] = Field(default_factory=list, max_length=20)
    projects: list[Project] = Field(default_factory=list, max_length=30)


class Preferences(StrictModel):
    work_mode: str = "any"
    preferred_locations: list[ShortText] = Field(default_factory=list, max_length=10)
    open_to_relocation: bool = True
    # Self-ratings, 1 (low) to 5 (high). Replaced by assessments in Phase 5.
    risk_tolerance: Rating | None = None
    leadership: Rating | None = None
    creativity: Rating | None = None
    team_orientation: Rating | None = None
    research_orientation: Rating | None = None

    @field_validator("work_mode")
    @classmethod
    def valid_work_mode(cls, value):
        return _check_choice(value, opt.keys(opt.WORK_MODES), "work mode")


class ProfileIn(StrictModel):
    full_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
    age: int | None = Field(default=None, ge=10, le=100)
    location: ShortText | None = None
    current_stage: str
    education: Education = Field(default_factory=Education)
    skills: list[Skill] = Field(default_factory=list, max_length=100)
    certifications: list[Certification] = Field(default_factory=list, max_length=50)
    experience: Experience = Field(default_factory=Experience)
    interests: list[str] = Field(default_factory=list, max_length=len(opt.INTERESTS))
    goals: list[str] = Field(default_factory=list, max_length=len(opt.GOALS))
    preferences: Preferences = Field(default_factory=Preferences)
    bio: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] | None = None

    @field_validator("current_stage")
    @classmethod
    def valid_stage(cls, value):
        return _check_choice(value, opt.keys(opt.STAGES), "stage")

    @field_validator("interests")
    @classmethod
    def valid_interests(cls, values):
        return _check_choice_list(values, opt.keys(opt.INTERESTS), "interest")

    @field_validator("goals")
    @classmethod
    def valid_goals(cls, values):
        return _check_choice_list(values, opt.keys(opt.GOALS), "goal")

    @field_validator("skills")
    @classmethod
    def unique_skills(cls, values: list[Skill]):
        seen, result = set(), []
        for skill in values:
            key = skill.name.casefold()
            if key not in seen:  # "Python" and "python" count as one skill
                seen.add(key)
                result.append(skill)
        return result


class ProfileOut(ProfileIn):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    updated_at: datetime
