"""Production mode: FastAPI serves the React build next to the API."""
from fastapi import FastAPI
from fastapi.testclient import TestClient

from services.frontend import mount_frontend


def make_app(tmp_path):
    (tmp_path / "assets").mkdir(parents=True)
    (tmp_path / "index.html").write_text("<!doctype html><div id=root></div>", encoding="utf-8")
    (tmp_path / "assets" / "app-123.js").write_text("console.log(1)", encoding="utf-8")
    (tmp_path / "robots.txt").write_text("User-agent: *", encoding="utf-8")
    (tmp_path.parent / "secret.txt").write_text("do not serve", encoding="utf-8")
    app = FastAPI()

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    assert mount_frontend(app, tmp_path) is True
    return TestClient(app)


def test_serves_app_assets_and_spa_routes(tmp_path):
    client = make_app(tmp_path / "dist")
    assert client.get("/api/health").json() == {"status": "ok"}
    asset = client.get("/assets/app-123.js")
    assert asset.status_code == 200 and "immutable" in asset.headers["cache-control"]
    assert client.get("/robots.txt").text == "User-agent: *"
    for path in ("/", "/careers/CAR_DATA_SCIENTIST", "/roadmap?career=x", "/no-such-page"):
        r = client.get(path)
        assert r.status_code == 200 and "id=root" in r.text and r.headers["cache-control"] == "no-cache"


def test_never_serves_api_or_files_outside_dist(tmp_path):
    client = make_app(tmp_path / "dist")
    assert client.get("/api/unknown").status_code == 404
    assert "do not serve" not in client.get("/..%2Fsecret.txt").text
    assert "do not serve" not in client.get("/assets/..%2F..%2Fsecret.txt").text


def test_missing_build_is_reported(tmp_path):
    assert mount_frontend(FastAPI(), tmp_path / "nothing") is False