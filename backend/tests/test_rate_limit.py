"""Rate limiting: client IP behind proxies, per-account failed-login limit."""
import pytest
from starlette.requests import Request

from config import settings
from services.rate_limit import RateLimiter, account_limiter, client_ip

from .conftest import PASSWORD


def _request(peer="10.0.0.1", forwarded=None) -> Request:
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded is not None else []
    return Request({"type": "http", "client": (peer, 1234), "headers": headers, "method": "GET", "path": "/"})


@pytest.fixture
def hops(monkeypatch):
    def _set(n):
        monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", n)
    return _set


def test_no_trusted_proxy_ignores_forwarded_header(hops):
    hops(0)
    # A client can't pick its own IP by sending the header
    assert client_ip(_request(forwarded="1.2.3.4")) == "10.0.0.1"


def test_one_trusted_proxy_uses_rightmost_forwarded_address(hops):
    hops(1)
    assert client_ip(_request(forwarded="203.0.113.7")) == "203.0.113.7"
    # The client forged "6.6.6.6"; the proxy appended the real address on the right
    assert client_ip(_request(forwarded="6.6.6.6, 203.0.113.7")) == "203.0.113.7"


def test_two_trusted_proxies(hops):
    hops(2)
    assert client_ip(_request(forwarded="6.6.6.6, 203.0.113.7, 10.1.1.1")) == "203.0.113.7"


def test_missing_forwarded_header_falls_back_to_peer(hops):
    hops(1)
    assert client_ip(_request()) == "10.0.0.1"
    assert client_ip(_request(forwarded=" , ")) == "10.0.0.1"


def test_ip_limit_is_per_client_behind_proxy(client, hops, monkeypatch):
    """Behind a proxy all traffic comes from one peer; visitors must not share one limit."""
    hops(1)
    for i in range(settings.AUTH_RATE_LIMIT):
        r = client.post("/api/auth/login", json={"email": f"a{i}@example.com", "password": "wrong999"},
                        headers={"X-Forwarded-For": "198.51.100.1"})
        assert r.status_code == 401
    blocked = client.post("/api/auth/login", json={"email": "z@example.com", "password": "wrong999"},
                          headers={"X-Forwarded-For": "198.51.100.1"})
    assert blocked.status_code == 429
    other = client.post("/api/auth/login", json={"email": "z@example.com", "password": "wrong999"},
                        headers={"X-Forwarded-For": "198.51.100.2"})
    assert other.status_code == 401


def test_account_paused_after_failed_logins_from_many_ips(client, make_user, hops):
    hops(1)
    make_user()
    client.post("/api/auth/logout")
    for i in range(settings.ACCOUNT_RATE_LIMIT):
        r = client.post("/api/auth/login", json={"email": "user@example.com", "password": "wrong999"},
                        headers={"X-Forwarded-For": f"198.51.100.{i}"})
        assert r.status_code == 401
    # Even the right password from a fresh IP waits until the window passes
    blocked = client.post("/api/auth/login", json={"email": "user@example.com", "password": PASSWORD},
                          headers={"X-Forwarded-For": "192.0.2.99"})
    assert blocked.status_code == 429
    assert "this account" in blocked.json()["detail"]
    assert "Retry-After" in blocked.headers
    # Other accounts are unaffected
    other = client.post("/api/auth/login", json={"email": "other@example.com", "password": "wrong999"},
                        headers={"X-Forwarded-For": "192.0.2.99"})
    assert other.status_code == 401


def test_successful_login_resets_account_counter(client, make_user):
    make_user()
    client.post("/api/auth/logout")
    for _ in range(settings.ACCOUNT_RATE_LIMIT - 1):
        client.post("/api/auth/login", json={"email": "user@example.com", "password": "wrong999"})
    assert client.post("/api/auth/login", json={"email": "user@example.com", "password": PASSWORD}).status_code == 200
    # Counter cleared: the next typo is just a 401, not a lockout
    assert client.post("/api/auth/login", json={"email": "user@example.com", "password": "wrong999"}).status_code == 401
    assert "login:user@example.com" in account_limiter._hits


def test_account_limit_uses_normalised_email(client, make_user):
    make_user()
    client.post("/api/auth/logout")
    for i in range(settings.ACCOUNT_RATE_LIMIT):
        email = "USER@example.com" if i % 2 else " user@Example.com "
        client.post("/api/auth/login", json={"email": email, "password": "wrong999"})
    assert client.post("/api/auth/login", json={"email": "user@example.com", "password": PASSWORD}).status_code == 429


def test_limiter_check_without_consume_does_not_count():
    limiter = RateLimiter(2, 60)
    for _ in range(5):
        limiter.check("k", consume=False)
    assert "k" not in limiter._hits
    limiter.hit("k")
    limiter.hit("k")
    with pytest.raises(Exception) as exc:
        limiter.check("k", consume=False)
    assert exc.value.status_code == 429
