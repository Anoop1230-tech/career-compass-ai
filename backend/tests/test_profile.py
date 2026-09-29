"""Profile: create, read, update, delete, validation, and privacy between users."""
import pytest
from fastapi.testclient import TestClient

from app import app

from .conftest import valid_profile


def test_options_endpoint_is_public_and_complete(client):
    body = client.get("/api/profile/options").json()
    stage_values = [s["value"] for s in body["stages"]]
    assert len(stage_values) == 17  # includes "not_studying"
    assert {"class_10", "ug_student", "working_professional", "career_changer", "other"} <= set(stage_values)
    for key in ("streams", "score_types", "skill_categories", "skill_levels", "interests", "goals", "work_modes"):
        assert body[key] and all({"value", "label"} <= set(item) for item in body[key])


def test_profile_requires_login(client):
    assert client.get("/api/profile").status_code == 401
    assert client.put("/api/profile", json=valid_profile()).status_code == 401
    assert client.delete("/api/profile").status_code == 401


def test_create_read_update_delete(make_user):
    client = make_user()
    assert client.get("/api/profile").status_code == 404

    created = client.put("/api/profile", json=valid_profile())
    assert created.status_code == 200, created.text
    assert created.json()["education"]["branch"] == "Computer Science"
    assert created.json()["experience"]["projects"][0]["link"] == "https://github.com/example/movies"
    assert client.get("/api/auth/me").json()["has_profile"] is True

    updated = client.put("/api/profile", json=valid_profile(current_stage="fresh_graduate", skills=[]))
    assert updated.json()["current_stage"] == "fresh_graduate"
    assert updated.json()["skills"] == []

    fetched = client.get("/api/profile").json()
    assert fetched["current_stage"] == "fresh_graduate"

    assert client.delete("/api/profile").status_code == 204
    assert client.get("/api/profile").status_code == 404
    assert client.delete("/api/profile").status_code == 204  # deleting twice is safe


@pytest.mark.parametrize(
    "stage",
    ["class_10", "class_11_12", "diploma", "masters_student", "phd_graduate", "working_professional",
     "experienced_professional", "career_changer", "job_seeker", "not_studying", "entrepreneur", "other"],
)
def test_every_stage_can_save_a_minimal_profile(make_user, stage):
    client = make_user()
    response = client.put("/api/profile", json={"full_name": "Test User", "current_stage": stage})
    assert response.status_code == 200, response.text


def test_minimal_profile_gets_safe_defaults(make_user):
    client = make_user()
    body = client.put("/api/profile", json={"full_name": "Ravi", "current_stage": "class_10"}).json()
    assert body["skills"] == [] and body["goals"] == [] and body["interests"] == []
    assert body["preferences"]["work_mode"] == "any"
    assert body["experience"]["projects"] == []


def test_duplicates_are_removed(make_user):
    client = make_user()
    body = client.put(
        "/api/profile",
        json=valid_profile(
            interests=["technology", "technology", "law"],
            skills=[{"name": "Python"}, {"name": "python "}, {"name": "SQL"}],
        ),
    ).json()
    assert body["interests"] == ["technology", "law"]
    assert [s["name"] for s in body["skills"]] == ["Python", "SQL"]


@pytest.mark.parametrize(
    "overrides,field",
    [
        ({"full_name": "A"}, "full_name"),
        ({"full_name": "   "}, "full_name"),
        ({"current_stage": "astronaut"}, "current_stage"),
        ({"age": 5}, "age"),
        ({"interests": ["cooking_robots"]}, "interests"),
        ({"goals": ["rule_the_world"]}, "goals"),
        ({"education": {"score": 9.1}}, "education"),  # score without a type
        ({"education": {"score_type": "cgpa_10", "score": 11}}, "education"),
        ({"education": {"score_type": "percentage", "score": 101}}, "education"),
        ({"education": {"stream": "magic"}}, "education.stream"),
        ({"skills": [{"name": "Python", "level": "god"}]}, "skills.0.level"),
        ({"skills": [{"name": ""}]}, "skills.0.name"),
        ({"preferences": {"leadership": 9}}, "preferences.leadership"),
        ({"experience": {"projects": [{"title": "X", "link": "javascript:alert(1)"}]}}, "experience.projects.0.link"),
        ({"unknown_field": 1}, "unknown_field"),
    ],
)
def test_invalid_profiles_rejected_with_field_name(make_user, overrides, field):
    client = make_user()
    response = client.put("/api/profile", json=valid_profile(**overrides))
    assert response.status_code == 422
    fields = [e["field"] for e in response.json()["errors"]]
    assert any(f.startswith(field) for f in fields), fields


def test_malformed_json_is_422_not_500(make_user):
    client = make_user()
    response = client.put("/api/profile", content="{not json", headers={"Content-Type": "application/json"})
    assert response.status_code == 422


def test_users_cannot_see_each_others_profiles(make_user):
    alice = make_user("alice@example.com")
    alice.put("/api/profile", json=valid_profile(full_name="Alice"))

    with TestClient(app) as bob:
        bob.post("/api/auth/register", json={"email": "bob@example.com", "password": "bobpass123"})
        assert bob.get("/api/profile").status_code == 404  # Bob sees nothing of Alice's
        bob.put("/api/profile", json=valid_profile(full_name="Bob"))

    assert alice.get("/api/profile").json()["full_name"] == "Alice"
