"""Error handling: every failure must come back as clean JSON, never a stack trace."""
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app import app
from database import get_db

# raise_server_exceptions=False: behave like a real server and return
# the 500 response instead of re-raising the error inside the test.
client = TestClient(app, raise_server_exceptions=False)


class BrokenSession:
    def __init__(self, error):
        self.error = error

    def execute(self, *args, **kwargs):
        raise self.error


def override_db_with(error):
    def _get_db():
        yield BrokenSession(error)

    return _get_db


def teardown_function():
    app.dependency_overrides.clear()


def test_unknown_api_route_returns_json_404():
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}


def test_wrong_method_returns_json_405():
    response = client.post("/api/health")
    assert response.status_code == 405
    assert "detail" in response.json()


def test_database_failure_returns_503_json():
    app.dependency_overrides[get_db] = override_db_with(
        OperationalError("SELECT 1", {}, Exception("db down"))
    )
    response = client.get("/api/health")
    assert response.status_code == 503
    assert response.json()["detail"].startswith("The database is unavailable")


def test_unexpected_error_returns_500_without_leaking_details():
    app.dependency_overrides[get_db] = override_db_with(RuntimeError("secret internal detail"))
    response = client.get("/api/health")
    assert response.status_code == 500
    assert response.json() == {"detail": "Something went wrong on the server.", "code": "server.error"}
    assert "secret" not in response.text


def test_root_and_docs_available():
    assert client.get("/").status_code == 200
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").json()["info"]["title"] == "Career Compass AI API"
