"""HTTP hardening: security headers, no caching of personal data, size limit, gzip."""


def test_security_headers_on_api_and_errors(client):
    for path in ("/api/health", "/api/nope"):
        r = client.get(path)
        assert r.headers["X-Content-Type-Options"] == "nosniff"
        assert r.headers["X-Frame-Options"] == "DENY"
        assert "frame-ancestors 'none'" in r.headers["Content-Security-Policy"]
        assert r.headers["Cache-Control"] == "no-store"
        assert "Strict-Transport-Security" not in r.headers  # only in production (HTTPS)


def test_docs_keep_working(client):
    r = client.get("/docs")
    assert r.status_code == 200 and "Content-Security-Policy" not in r.headers


def test_large_bodies_are_rejected(client):
    r = client.post("/api/auth/login", content=b"x" * (300 * 1024), headers={"Content-Type": "application/json"})
    assert r.status_code == 413 and r.json()["detail"] == "Request is too large."


def test_gzip_for_large_responses(client):
    from catalog.seed import seed
    from database import SessionLocal

    with SessionLocal() as db:
        seed(db, force=True)
    r = client.get("/api/catalog/skills", headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200 and r.headers.get("content-encoding") == "gzip"