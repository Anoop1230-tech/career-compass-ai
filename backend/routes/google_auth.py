"""Sign in with Google (OpenID Connect authorization-code flow with PKCE).

1. GET /api/auth/google/login     sends the browser to Google's account chooser.
2. Google sends it back to GET /api/auth/google/callback?code=...&state=...
3. The server swaps the code for an ID token directly with Google over TLS. Because the
   token comes straight from Google's token endpoint, its signature doesn't need to be
   re-checked (OpenID Connect Core 3.1.3.7); audience, issuer, expiry and "email verified"
   are checked here. Then the normal session cookie is set, same as a password login.

No Google script runs in the browser, so the strict Content-Security-Policy is unchanged.
Everything here answers 404 unless GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
"""
import base64
import hashlib
import logging
import secrets
import time
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import User
from routes.auth import _set_session_cookie
from services.auth import hash_password, revoke_sessions
from services.rate_limit import limit_auth_attempts

log = logging.getLogger("career_compass.google")

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
ISSUERS = {"https://accounts.google.com", "accounts.google.com"}
STATE_COOKIE = "cc_google_oauth"
STATE_PATH = "/api/auth/google"
STATE_SECONDS = 600  # the round trip to Google must finish within 10 minutes
STATE_PURPOSE = "google_oauth"

router = APIRouter(prefix="/auth/google", tags=["auth"])


class GoogleSignInError(Exception):
    """`code` is shown to the user as /login?error=google_<code>."""

    def __init__(self, code: str, detail: str = ""):
        super().__init__(detail or code)
        self.code = code


def is_enabled() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def redirect_uri() -> str:
    # Must be listed exactly like this under "Authorised redirect URIs" in Google Cloud
    return f"{settings.APP_BASE_URL}/api/auth/google/callback"


def _require_enabled() -> None:
    if not is_enabled():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Google sign-in is not set up on this server.")


def _safe_next(value: str) -> str:
    """Only paths on this site (no //evil.com, no backslashes), never back into the API."""
    if value.startswith("/") and not value.startswith("//") and "\\" not in value and not value.startswith("/api"):
        return value[:300]
    return ""


def _pkce_challenge(verifier: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()


def _back_to_login(code: str) -> RedirectResponse:
    response = RedirectResponse(f"/login?error=google_{code}", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie(STATE_COOKIE, path=STATE_PATH)
    return response


@router.get("/status")
def google_status():
    """Lets the login page decide whether to show the "Continue with Google" button."""
    return {"enabled": is_enabled()}


@router.get("/login", dependencies=[Depends(_require_enabled)])
def google_login(next_path: str = Query("", alias="next", max_length=300)):
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",  # profile = name, used to pre-fill the profile form
        "state": state,
        "code_challenge": _pkce_challenge(verifier),
        "code_challenge_method": "S256",
        "prompt": "select_account",
    }
    response = RedirectResponse(f"{AUTH_URL}?{urlencode(params)}", status_code=status.HTTP_302_FOUND)
    # Signed with SECRET_KEY so it can't be forged; httpOnly and only sent to /api/auth/google
    saved = jwt.encode(
        {"purpose": STATE_PURPOSE, "state": state, "verifier": verifier, "next": _safe_next(next_path),
         "exp": int(time.time()) + STATE_SECONDS},
        settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM,
    )
    response.set_cookie(
        STATE_COOKIE, saved, max_age=STATE_SECONDS, httponly=True, secure=settings.is_production,
        samesite="lax",  # sent on Google's top-level redirect back to us
        path=STATE_PATH,
    )
    return response


def exchange_code(code: str, verifier: str) -> dict:
    """Swaps the one-time code for Google's ID token and returns its checked claims."""
    try:
        reply = httpx.post(TOKEN_URL, timeout=10, data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri(),
            "grant_type": "authorization_code",
            "code_verifier": verifier,
        })
    except httpx.HTTPError as exc:
        raise GoogleSignInError("failed", f"token endpoint unreachable: {exc.__class__.__name__}") from exc
    if reply.status_code != 200:
        raise GoogleSignInError("failed", f"token endpoint answered {reply.status_code}")
    id_token = (reply.json() or {}).get("id_token")
    if not id_token:
        raise GoogleSignInError("failed", "no id_token in the reply")
    try:
        # Received directly from Google over TLS (see module docstring); claims are checked below
        claims = jwt.decode(id_token, options={"verify_signature": False})
    except jwt.PyJWTError as exc:
        raise GoogleSignInError("failed", "unreadable id_token") from exc

    audience = claims.get("aud")
    audiences = audience if isinstance(audience, list) else [audience]
    if settings.GOOGLE_CLIENT_ID not in audiences:
        raise GoogleSignInError("failed", "wrong audience")
    if claims.get("iss") not in ISSUERS:
        raise GoogleSignInError("failed", "wrong issuer")
    if not isinstance(claims.get("exp"), (int, float)) or claims["exp"] < time.time() - 60:
        raise GoogleSignInError("failed", "expired id_token")
    if not claims.get("sub") or not claims.get("email"):
        raise GoogleSignInError("failed", "no account id or email")
    if claims.get("email_verified") is not True:
        raise GoogleSignInError("unverified", "Google has not verified this email")
    return claims


def find_or_create_user(db: Session, claims: dict) -> User:
    sub = str(claims["sub"])
    email = str(claims["email"]).strip().lower()
    if len(email) > 254:
        raise GoogleSignInError("failed", "email too long")

    name = " ".join(str(claims.get("name") or "").split())[:100] or None

    user = db.scalar(select(User).where(User.google_sub == sub))
    if user is None:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            # New account. The password is random and never shown: this account signs in with
            # Google (or sets a password later through "Forgot password?").
            user = User(email=email, password_hash=hash_password(secrets.token_urlsafe(32)),
                        token_version=0, google_sub=sub)
            db.add(user)
        elif user.google_sub is None:
            # Existing password account with the same email. Google has just proved this person
            # owns the email, but sign-up never did, so someone else may have registered it first.
            # Linking therefore signs out every other session and retires the old password.
            user.google_sub = sub
            user.password_hash = hash_password(secrets.token_urlsafe(32))
            revoke_sessions(user)
        else:
            raise GoogleSignInError("conflict", "email already linked to another Google account")
    if name and len(name) >= 2:
        user.display_name = name
    try:
        db.commit()
    except IntegrityError as exc:  # the same Google account signing in twice at the same moment
        db.rollback()
        raise GoogleSignInError("failed", "account changed during sign-in") from exc
    db.refresh(user)
    return user


@router.get("/callback", dependencies=[Depends(_require_enabled), Depends(limit_auth_attempts)])
def google_callback(
    request: Request,
    code: str = Query("", max_length=2048),
    state: str = Query("", max_length=200),
    error: str = Query("", max_length=200),
    db: Session = Depends(get_db),
):
    try:
        saved = jwt.decode(request.cookies.get(STATE_COOKIE, ""), settings.SECRET_KEY,
                           algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        return _back_to_login("expired")  # no cookie, tampered, or older than 10 minutes
    if saved.get("purpose") != STATE_PURPOSE or not secrets.compare_digest(str(saved.get("state", "")), state):
        return _back_to_login("expired")
    if error or not code:
        return _back_to_login("cancelled")  # e.g. the user closed Google's consent screen

    try:
        user = find_or_create_user(db, exchange_code(code, str(saved.get("verifier", ""))))
    except GoogleSignInError as exc:
        log.warning("Google sign-in failed: %s", exc)
        return _back_to_login(exc.code)

    target = saved.get("next") or ("/dashboard" if user.profile is not None else "/profile/edit")
    response = RedirectResponse(target, status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie(STATE_COOKIE, path=STATE_PATH)
    _set_session_cookie(response, user)
    return response
