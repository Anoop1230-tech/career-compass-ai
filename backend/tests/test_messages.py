"""Error responses carry a stable `code` (and `params`) next to the English text, for translation."""
from services.messages import MESSAGE_CODES, message_code


def test_known_messages_get_a_code():
    assert message_code("Incorrect email or password.") == {"code": "auth.bad_login"}
    assert message_code("Score cannot be more than 10 for this score type") == {
        "code": "profile.score_too_high", "params": {"max": "10"}}
    assert message_code("Something nobody wrote") == {}
    assert message_code(None) == {}


def test_codes_are_unique():
    assert len(set(MESSAGE_CODES.values())) == len(MESSAGE_CODES)


def test_http_errors_include_the_code(client):
    r = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "Wrong12345"})
    assert r.status_code == 401
    assert r.json() == {"detail": "Incorrect email or password.", "code": "auth.bad_login"}

    r = client.get("/api/catalog/careers/CAR_DOES_NOT_EXIST")
    assert r.status_code == 404
    assert r.json()["code"] == "career.not_found"


def test_unknown_messages_keep_the_plain_shape(client):
    r = client.get("/api/no-such-route")
    assert r.status_code == 404
    assert r.json() == {"detail": "Not Found"}


def test_validation_errors_include_codes(client):
    r = client.post("/api/auth/register", json={"email": "a@example.com", "password": "short", "full_name": "A"})
    assert r.status_code == 422
    codes = {e["field"]: e.get("code") for e in r.json()["errors"]}
    assert codes["password"] == "v.string_too_short"
    first = next(e for e in r.json()["errors"] if e["field"] == "password")
    assert first["params"]["min_length"] == 8

    r = client.post("/api/auth/register", json={"email": "a@example.com", "password": "onlyletters", "full_name": "A"})
    assert r.status_code == 422
    assert r.json()["errors"][0]["code"] == "auth.password_weak"


def test_rate_limit_keeps_retry_after_header(client):
    from services.rate_limit import auth_limiter
    for _ in range(auth_limiter.limit + 1):
        r = client.post("/api/auth/login", json={"email": "x@example.com", "password": "Wrong12345"})
    assert r.status_code == 429
    assert r.json()["code"] == "rate.too_many"
    assert "Retry-After" in r.headers



def test_every_code_has_frontend_text():
    """Each code needs an "err.<code>" entry in the English dictionary (hi.js is checked against en.js)."""
    import re
    from pathlib import Path
    from services.messages import PATTERNS, VALIDATION_TYPES

    en = (Path(__file__).resolve().parents[2] / "frontend" / "src" / "i18n" / "en.js").read_text(encoding="utf-8")
    keys = set(re.findall(r'"err\.([\w.]+)":', en))
    codes = set(MESSAGE_CODES.values()) | {code for _, code in PATTERNS}
    codes |= {f"v.{t}" for t in VALIDATION_TYPES if t != "value_error"}
    assert codes - keys == set()
