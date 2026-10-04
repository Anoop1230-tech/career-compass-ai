"""Sign in with Google: redirect, state check, token checks, account creation and linking."""
import time
from urllib.parse import parse_qs, urlparse

import httpx
import jwt
import pytest
from sqlalchemy import select

from config import settings
from database import SessionLocal
from models import User
from routes import google_auth

from .conftest import PASSWORD

CLIENT_ID = "test-client.apps.googleusercontent.com"


@pytest.fixture
def google(monkeypatch):
    """Turns Google sign-in on and fakes Google's token endpoint."""
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", CLIENT_ID)
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-secret")
    fake = {"claims": {}, "status": 200, "calls": []}

    def post(url, data, timeout):
        fake["calls"].append({"url": url, **data})
        claims = {"iss": "https://accounts.google.com", "aud": CLIENT_ID, "sub": "g-123",
                  "email": "Asha@Gmail.com", "email_verified": True, "exp": int(time.time()) + 3600,
                  **fake["claims"]}
        token = jwt.encode(claims, "google-signs-this", algorithm="HS256")
        return httpx.Response(fake["status"], json={"id_token": token, "access_token": "x"})

    monkeypatch.setattr(google_auth.httpx, "post", post)
    return fake


def start(client, next_path=""):
    response = client.get("/api/auth/google/login", params={"next": next_path} if next_path else None,
                          follow_redirects=False)
    assert response.status_code == 302
    return parse_qs(urlparse(response.headers["location"]).query)


def finish(client, state, code="one-time-code"):
    return client.get("/api/auth/google/callback", params={"code": code, "state": state}, follow_redirects=False)


def test_disabled_without_client_id(client):
    assert client.get("/api/auth/google/status").json() == {"enabled": False}
    assert client.get("/api/auth/google/login", follow_redirects=False).status_code == 404
    assert client.get("/api/auth/google/callback", follow_redirects=False).status_code == 404


def test_login_redirects_to_google_with_pkce_and_state_cookie(client, google):
    assert client.get("/api/auth/google/status").json() == {"enabled": True}
    response = client.get("/api/auth/google/login", follow_redirects=False)
    location = urlparse(response.headers["location"])
    assert f"{location.scheme}://{location.netloc}{location.path}" == google_auth.AUTH_URL
    query = parse_qs(location.query)
    assert query["client_id"] == [CLIENT_ID]
    assert query["redirect_uri"] == [f"{settings.APP_BASE_URL}/api/auth/google/callback"]
    assert query["scope"] == ["openid email"]
    assert query["code_challenge_method"] == ["S256"]
    cookie = response.headers["set-cookie"].lower()
    assert "cc_google_oauth" in cookie and "httponly" in cookie and "path=/api/auth/google" in cookie


def test_new_google_user_is_created_and_logged_in(client, google):
    query = start(client)
    response = finish(client, query["state"][0])
    assert response.status_code == 303
    assert response.headers["location"] == "/profile/edit"  # no profile yet
    assert client.get("/api/auth/me").json()["email"] == "asha@gmail.com"

    # The PKCE verifier sent to Google matches the challenge from step 1
    call = google["calls"][0]
    assert call["code"] == "one-time-code" and call["grant_type"] == "authorization_code"
    assert google_auth._pkce_challenge(call["code_verifier"]) == query["code_challenge"][0]
    with SessionLocal() as db:
        assert db.scalar(select(User).where(User.email == "asha@gmail.com")).google_sub == "g-123"


def test_next_path_is_kept_but_only_on_this_site(client, google):
    assert finish(client, start(client, "/careers/CAR_X")["state"][0]).headers["location"] == "/careers/CAR_X"
    for bad in ("//evil.example", "https://evil.example", "/api/auth/me", "/\\evil.example"):
        client.cookies.clear()
        assert finish(client, start(client, bad)["state"][0]).headers["location"] == "/profile/edit"


def test_second_sign_in_reuses_the_account(client, google):
    finish(client, start(client)["state"][0])
    client.cookies.clear()
    google["claims"] = {"email": "renamed@gmail.com"}  # same Google account, new address
    finish(client, start(client)["state"][0])
    assert client.get("/api/auth/me").json()["email"] == "asha@gmail.com"
    with SessionLocal() as db:
        assert len(db.scalars(select(User)).all()) == 1


def test_existing_password_account_is_linked_and_old_sessions_end(client, google):
    other = client.__class__(client.app)
    assert other.post("/api/auth/register", json={"email": "asha@gmail.com", "password": PASSWORD}).status_code == 201
    assert other.get("/api/auth/me").status_code == 200

    finish(client, start(client)["state"][0])
    assert client.get("/api/auth/me").json()["email"] == "asha@gmail.com"
    # The earlier password session is signed out and the unverified password no longer works
    assert other.get("/api/auth/me").status_code == 401
    assert other.post("/api/auth/login", json={"email": "asha@gmail.com", "password": PASSWORD}).status_code == 401


def test_wrong_or_missing_state_is_rejected(client, google):
    start(client)
    response = finish(client, "not-the-state")
    assert response.headers["location"] == "/login?error=google_expired"
    client.cookies.clear()
    assert finish(client, "anything").headers["location"] == "/login?error=google_expired"
    assert google["calls"] == []  # Google was never asked


def test_user_cancelled_on_google(client, google):
    state = start(client)["state"][0]
    response = client.get("/api/auth/google/callback", params={"error": "access_denied", "state": state},
                          follow_redirects=False)
    assert response.headers["location"] == "/login?error=google_cancelled"


@pytest.mark.parametrize("claims, error", [
    ({"aud": "someone-elses-client"}, "google_failed"),
    ({"iss": "https://evil.example"}, "google_failed"),
    ({"exp": int(time.time()) - 3600}, "google_failed"),
    ({"email_verified": False}, "google_unverified"),
])
def test_bad_id_tokens_are_refused(client, google, claims, error):
    google["claims"] = claims
    response = finish(client, start(client)["state"][0])
    assert response.headers["location"] == f"/login?error={error}"
    assert client.get("/api/auth/me").status_code == 401
    with SessionLocal() as db:
        assert db.scalars(select(User)).all() == []


def test_token_endpoint_error_is_handled(client, google):
    google["status"] = 400
    assert finish(client, start(client)["state"][0]).headers["location"] == "/login?error=google_failed"
