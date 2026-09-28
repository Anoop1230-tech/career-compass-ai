"""Shared test setup.

Tests use their OWN database file, so running tests never touches your
real development data. Every test starts with empty tables."""
import os
import tempfile
from pathlib import Path

# Must be set BEFORE the app is imported (config reads it at import time).
_TEST_DB = Path(tempfile.gettempdir()) / "career_compass_pytest.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB.as_posix()}"
os.environ["ENVIRONMENT"] = "test"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import app  # noqa: E402
from database import Base, engine, init_db  # noqa: E402
from services.rate_limit import auth_limiter  # noqa: E402


@pytest.fixture(autouse=True)
def clean_database():
    init_db()
    yield
    Base.metadata.drop_all(bind=engine)
    auth_limiter.reset()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


PASSWORD = "secret123"


@pytest.fixture
def make_user(client):
    """Registers a user and returns a logged-in TestClient for them."""

    def _make(email="user@example.com", password=PASSWORD):
        response = client.post("/api/auth/register", json={"email": email, "password": password})
        assert response.status_code == 201, response.text
        return client

    return _make


def valid_profile(**overrides):
    profile = {
        "full_name": "Asha Verma",
        "age": 21,
        "location": "Pune",
        "current_stage": "ug_student",
        "education": {
            "degree": "B.Tech",
            "branch": "Computer Science",
            "institution": "Example Institute of Technology",
            "year_of_study": 3,
            "graduation_year": 2028,
            "score_type": "cgpa_10",
            "score": 8.4,
        },
        "skills": [
            {"name": "Python", "category": "programming", "level": "intermediate"},
            {"name": "SQL", "category": "technical", "level": "beginner"},
        ],
        "certifications": [{"name": "NPTEL Python", "issuer": "NPTEL", "year": 2025}],
        "experience": {
            "internships": [{"title": "Web intern", "organization": "Startup", "duration_months": 2}],
            "projects": [
                {
                    "title": "Movie recommender",
                    "technologies": ["Python", "Pandas"],
                    "link": "https://github.com/example/movies",
                }
            ],
        },
        "interests": ["technology", "research"],
        "goals": ["job", "higher_studies"],
        "preferences": {"work_mode": "hybrid", "leadership": 3, "research_orientation": 4},
    }
    profile.update(overrides)
    return profile
