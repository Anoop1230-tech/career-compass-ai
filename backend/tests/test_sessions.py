"""Sessions: logout revokes the token, change password, password reset by email."""
import re
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from config import settings
from database import SessionLocal
from models import PasswordResetToken, User
from services import mailer

from .conftest import PASSWORD

NEW_PASSWORD = "brandnew456"


@pytest.fixture
def outbox(monkeypatch):
    sent = []
    monkeypatch.setattr(mailer, "outbox", sent)
    return sent


def session_cookie(client) -> str:
    return client.cookies.get(settings.AUTH_COOKIE_NAME)


def use_cookie(client, token):
    client.cookies.clear()
    client.cookies.set(settings.AUTH_COOKIE_NAME, token, path="/api")


def login(client, password=PASSWORD, email="user@example.com"):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def request_reset(client, outbox, email="user@example.com") -> str:
    response = client.post("/api/auth/password-reset/request", json={"email": email})
    assert response.status_code == 202
    match = re.search(r"/reset-password#token=([\w-]+)", outbox[-1].get_content())
    assert match, outbox[-1].get_content()
    return match.group(1)


# ---------------------------------------------------------------- logout
def test_logout_revokes_stolen_copy_of_token(make_user):
    client = make_user()
    stolen = session_cookie(client)
    assert client.post("/api/auth/logout").status_code == 204
    use_cookie(client, stolen)  # the same token replayed after logout
    assert client.get("/api/auth/me").status_code == 401


def test_logout_signs_out_other_devices(make_user, client):
    make_user()
    device_a = session_cookie(client)
    login(client)
    device_b = session_cookie(client)
    client.post("/api/auth/logout")
    for token in (device_a, device_b):
        use_cookie(client, token)
        assert client.get("/api/auth/me").status_code == 401
    # Logging in again works
    assert login(client).status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_logout_without_session_is_fine(client):
    assert client.post("/api/auth/logout").status_code == 204


# ---------------------------------------------------------------- change password
def test_change_password(make_user, client):
    make_user()
    other_device = session_cookie(client)
    response = client.post("/api/auth/change-password",
                           json={"current_password": PASSWORD, "new_password": NEW_PASSWORD})
    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"
    # This device got a fresh cookie and stays logged in
    assert client.get("/api/auth/me").status_code == 200
    this_device = session_cookie(client)
    # The old token (other devices) no longer works
    use_cookie(client, other_device)
    assert client.get("/api/auth/me").status_code == 401
    use_cookie(client, this_device)
    client.post("/api/auth/logout")
    assert login(client).status_code == 401
    assert login(client, NEW_PASSWORD).status_code == 200


def test_change_password_wrong_current(make_user, client):
    make_user()
    r = client.post("/api/auth/change-password", json={"current_password": "nope1234", "new_password": NEW_PASSWORD})
    assert r.status_code == 400
    assert "current password" in r.json()["detail"]
    assert client.get("/api/auth/me").status_code == 200  # still logged in


def test_change_password_rules(make_user, client):
    make_user()
    same = client.post("/api/auth/change-password", json={"current_password": PASSWORD, "new_password": PASSWORD})
    assert same.status_code == 400
    weak = client.post("/api/auth/change-password", json={"current_password": PASSWORD, "new_password": "short"})
    assert weak.status_code == 422
    assert weak.json()["errors"][0]["field"] == "new_password"


def test_change_password_requires_login(client):
    r = client.post("/api/auth/change-password", json={"current_password": PASSWORD, "new_password": NEW_PASSWORD})
    assert r.status_code == 401


def test_change_password_guessing_is_limited(make_user, client):
    make_user()
    codes = [client.post("/api/auth/change-password",
                         json={"current_password": f"guess{i}x", "new_password": NEW_PASSWORD}).status_code
             for i in range(settings.ACCOUNT_RATE_LIMIT + 1)]
    assert codes[-1] == 429


# ---------------------------------------------------------------- password reset
def test_reset_flow(make_user, client, outbox):
    make_user()
    old_session = session_cookie(client)
    token = request_reset(client, outbox)
    message = outbox[-1]
    assert message["To"] == "user@example.com"
    assert settings.APP_BASE_URL in message.get_content()

    r = client.post("/api/auth/password-reset/confirm", json={"token": token, "new_password": NEW_PASSWORD})
    assert r.status_code == 204
    # Everyone holding the old session is signed out
    use_cookie(client, old_session)
    assert client.get("/api/auth/me").status_code == 401
    assert login(client).status_code == 401
    assert login(client, NEW_PASSWORD).status_code == 200
    # One-time link
    again = client.post("/api/auth/password-reset/confirm", json={"token": token, "new_password": "another789"})
    assert again.status_code == 400


def test_reset_same_answer_for_unknown_email(make_user, client, outbox):
    make_user()
    known = client.post("/api/auth/password-reset/request", json={"email": "user@example.com"})
    unknown = client.post("/api/auth/password-reset/request", json={"email": "nobody@example.com"})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert len(outbox) == 1  # only the real account gets an email


def test_reset_token_stored_only_as_hash(make_user, client, outbox):
    make_user()
    token = request_reset(client, outbox)
    with SessionLocal() as db:
        record = db.scalar(select(PasswordResetToken))
        assert record.token_hash != token and len(record.token_hash) == 64


def test_expired_reset_link_rejected(make_user, client, outbox):
    make_user()
    token = request_reset(client, outbox)
    with SessionLocal() as db:
        record = db.scalar(select(PasswordResetToken))
        record.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    r = client.post("/api/auth/password-reset/confirm", json={"token": token, "new_password": NEW_PASSWORD})
    assert r.status_code == 400
    assert "expired" in r.json()["detail"]


def test_only_newest_reset_link_works(make_user, client, outbox):
    make_user()
    first = request_reset(client, outbox)
    second = request_reset(client, outbox)
    assert client.post("/api/auth/password-reset/confirm",
                       json={"token": first, "new_password": NEW_PASSWORD}).status_code == 400
    assert client.post("/api/auth/password-reset/confirm",
                       json={"token": second, "new_password": NEW_PASSWORD}).status_code == 204


def test_changing_password_cancels_reset_links(make_user, client, outbox):
    make_user()
    token = request_reset(client, outbox)
    client.post("/api/auth/change-password", json={"current_password": PASSWORD, "new_password": NEW_PASSWORD})
    assert client.post("/api/auth/password-reset/confirm",
                       json={"token": token, "new_password": "another789"}).status_code == 400


@pytest.mark.parametrize("token", ["x" * 43, "not-a-real-token-but-long-enough"])
def test_bogus_reset_token_rejected(client, token):
    r = client.post("/api/auth/password-reset/confirm", json={"token": token, "new_password": NEW_PASSWORD})
    assert r.status_code == 400


def test_reset_requests_rate_limited_per_email(client, outbox):
    codes = [client.post("/api/auth/password-reset/request", json={"email": "victim@example.com"}).status_code
             for _ in range(settings.PASSWORD_RESET_RATE_LIMIT + 1)]
    assert codes[:-1] == [202] * settings.PASSWORD_RESET_RATE_LIMIT
    assert codes[-1] == 429


def test_reset_unlocks_paused_account(make_user, client, outbox):
    make_user()
    client.post("/api/auth/logout")
    for _ in range(settings.ACCOUNT_RATE_LIMIT):
        login(client, "wrong999")
    assert login(client).status_code == 429
    token = request_reset(client, outbox)
    client.post("/api/auth/password-reset/confirm", json={"token": token, "new_password": NEW_PASSWORD})
    assert login(client, NEW_PASSWORD).status_code == 200


def test_user_token_version_increases(make_user, client):
    make_user()
    client.post("/api/auth/logout")
    with SessionLocal() as db:
        assert db.scalar(select(User)).token_version == 1


def test_mailer_without_smtp_does_not_send_in_production(monkeypatch, caplog):
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert mailer.send("a@example.com", "Subject", "secret-link") is False
    assert "secret-link" not in caplog.text
