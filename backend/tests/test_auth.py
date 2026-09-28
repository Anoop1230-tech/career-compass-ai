"""Accounts: register, login, logout, session cookie, security rules."""
import jwt
import pytest
from sqlalchemy import select

from config import settings
from database import SessionLocal
from models import User
from services.auth import create_access_token

from .conftest import PASSWORD


def register(client, email="user@example.com", password=PASSWORD):
    return client.post("/api/auth/register", json={"email": email, "password": password})


def test_register_creates_account_and_logs_in(client):
    response = register(client, email="  New.User@Example.COM ")
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "new.user@example.com"  # trimmed + lowercased
    assert body["has_profile"] is False
    assert "password" not in response.text and "hash" not in response.text

    # Session cookie is set and works
    assert client.get("/api/auth/me").json()["email"] == "new.user@example.com"


def test_session_cookie_is_httponly_and_lax(client):
    response = register(client)
    cookie = response.headers["set-cookie"].lower()
    assert settings.AUTH_COOKIE_NAME in cookie
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "path=/api" in cookie


def test_password_is_hashed_in_database(client):
    register(client)
    with SessionLocal() as db:
        user = db.scalar(select(User))
        assert user.password_hash != PASSWORD
        assert user.password_hash.startswith("$argon2")


def test_duplicate_email_rejected(client):
    assert register(client).status_code == 201
    response = register(client, email="USER@example.com")
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


@pytest.mark.parametrize(
    "email,password,field",
    [
        ("not-an-email", PASSWORD, "email"),
        ("a@example.com", "short1", "password"),
        ("a@example.com", "onlyletters", "password"),
        ("a@example.com", "12345678", "password"),
        ("a@example.com", "x1" * 70, "password"),
    ],
)
def test_register_validation(client, email, password, field):
    response = register(client, email=email, password=password)
    assert response.status_code == 422
    body = response.json()
    assert body["errors"][0]["field"] == field
    assert isinstance(body["detail"], str)


def test_register_rejects_unknown_fields(client):
    response = client.post(
        "/api/auth/register", json={"email": "a@example.com", "password": PASSWORD, "is_admin": True}
    )
    assert response.status_code == 422


def test_login_success_and_wrong_password(client):
    register(client)
    client.post("/api/auth/logout")

    wrong = client.post("/api/auth/login", json={"email": "user@example.com", "password": "wrong999"})
    unknown = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": PASSWORD})
    assert wrong.status_code == unknown.status_code == 401
    # Same message for both: doesn't reveal which emails exist
    assert wrong.json()["detail"] == unknown.json()["detail"] == "Incorrect email or password."

    ok = client.post("/api/auth/login", json={"email": "USER@example.com", "password": PASSWORD})
    assert ok.status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_logout_clears_session(client):
    register(client)
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_me_requires_login(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Please log in to continue."


@pytest.mark.parametrize(
    "token",
    [
        "garbage",
        jwt.encode({"sub": "1", "exp": 9999999999, "type": "access"}, "wrong-secret-that-is-long-enough-for-hs256", algorithm="HS256"),
        jwt.encode({"sub": "1", "exp": 1, "type": "access"}, settings.SECRET_KEY, algorithm="HS256"),  # expired
        jwt.encode({"sub": "1", "exp": 9999999999}, settings.SECRET_KEY, algorithm="HS256"),  # no type
        jwt.encode({"sub": "1", "exp": 9999999999, "type": "access"}, None, algorithm="none"),  # unsigned
    ],
)
def test_forged_or_expired_tokens_rejected(client, token):
    register(client)
    client.cookies.clear()
    client.cookies.set(settings.AUTH_COOKIE_NAME, token, path="/api")
    assert client.get("/api/auth/me").status_code == 401


def test_token_for_deleted_user_rejected(client):
    register(client)
    with SessionLocal() as db:
        user = db.scalar(select(User))
        token = create_access_token(user.id)
        db.delete(user)
        db.commit()
    client.cookies.clear()
    client.cookies.set(settings.AUTH_COOKIE_NAME, token, path="/api")
    assert client.get("/api/auth/me").status_code == 401


def test_login_rate_limited(client):
    register(client)
    codes = [
        client.post("/api/auth/login", json={"email": "user@example.com", "password": "wrong999"}).status_code
        for _ in range(settings.AUTH_RATE_LIMIT + 2)
    ]
    assert 429 in codes
    blocked = client.post("/api/auth/login", json={"email": "user@example.com", "password": PASSWORD})
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers
