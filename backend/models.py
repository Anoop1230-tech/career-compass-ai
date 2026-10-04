"""Database tables (SQLAlchemy 2.0 ORM models)."""
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    """Login account. Only the password HASH is stored, never the password."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    # Google account id ("sub") once the user has signed in with Google
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    # Part of every login token. Increased on logout, password change and reset,
    # which makes every token issued before that moment invalid.
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    profile: Mapped["Profile"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class PasswordResetToken(Base):
    """One-time password reset link. Only a SHA-256 hash of the token is stored,
    so a database leak does not give anyone working reset links."""

    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Profile(Base):
    """One profile per user. Flexible sections are stored as JSON so the
    same table works for a Class 10 student and a senior professional."""

    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)

    # Basic
    full_name: Mapped[str] = mapped_column(String(100))
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    location: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Where the user is now (drives the Next Step Engine later)
    current_stage: Mapped[str] = mapped_column(String(40))

    # Structured sections (validated by Pydantic before saving)
    education: Mapped[dict] = mapped_column(JSON, default=dict)
    skills: Mapped[list] = mapped_column(JSON, default=list)
    certifications: Mapped[list] = mapped_column(JSON, default=list)
    experience: Mapped[dict] = mapped_column(JSON, default=dict)
    interests: Mapped[list] = mapped_column(JSON, default=list)
    goals: Mapped[list] = mapped_column(JSON, default=list)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    user: Mapped[User] = relationship(back_populates="profile")



class AssessmentAttempt(Base):
    """One sitting of a test. For aptitude, stores how the options were shuffled
    for this user, so the browser never needs to know the real answer letters."""

    __tablename__ = "assessment_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # interest | personality | aptitude
    # aptitude only: {question_id: {"a": "c", "b": "a", ...}} shown letter -> original letter
    option_map: Mapped[dict] = mapped_column(JSON, default=dict)
    question_order: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AssessmentResult(Base):
    """Latest scores of a user for one test kind (older results are kept for history)."""

    __tablename__ = "assessment_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20), index=True)
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RoadmapProgress(Base):
    """A user's roadmap for one career: skills marked as learned, and whether
    it is their current target (only one active target per user)."""

    __tablename__ = "roadmap_progress"
    __table_args__ = (UniqueConstraint("user_id", "career_id", name="uq_roadmap_user_career"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    career_id: Mapped[str] = mapped_column(String(40))
    completed_skill_ids: Mapped[list] = mapped_column(JSON, default=list)
    # Project checklist ticks as "PRJ_ID:step_index" strings
    completed_project_steps: Mapped[list] = mapped_column(JSON, default=list)
    is_target: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class MentorMessage(Base):
    """Chat history with the career mentor (kept per user, deletable by the user)."""

    __tablename__ = "mentor_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(10))  # "user" | "mentor"
    content: Mapped[str] = mapped_column(Text)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)  # intent, actions, suggestions, career_id, source
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RecommendationFeedback(Base):
    """A user's answer to "did this recommendation fit you?" for one career.

    Saved with a snapshot of the score and rank shown at that moment, so the
    rule engine can later be compared against real answers (see ml/evaluate.py).
    One answer per user and career (changing it overwrites); deleted with the account."""

    __tablename__ = "recommendation_feedback"
    __table_args__ = (UniqueConstraint("user_id", "career_id", name="uq_feedback_user_career"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    career_id: Mapped[str] = mapped_column(String(40), index=True)
    verdict: Mapped[str] = mapped_column(String(20))  # fits | not_for_me
    reason: Mapped[str | None] = mapped_column(String(30), nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

class ExamFollow(Base):
    """An exam the user follows: shown under "Coming up", in their calendar file and (if email is on) emailed.

    `reminded` holds the keys of events already emailed, so the reminder job never sends one twice."""

    __tablename__ = "exam_follows"
    __table_args__ = (UniqueConstraint("user_id", "exam_id", name="uq_follow_user_exam"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    exam_id: Mapped[str] = mapped_column(String(40))
    email: Mapped[bool] = mapped_column(Boolean, default=True)
    reminded: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
