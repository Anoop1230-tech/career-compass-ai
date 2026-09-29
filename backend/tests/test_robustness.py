"""Robustness: odd input never causes a server error, and engines stay fast."""
import time

import pytest

from catalog.seed import seed
from database import SessionLocal
from tests.conftest import valid_profile

ODD = ["", " ", "%00", "../../etc/passwd", "' OR 1=1 --", "<script>alert(1)</script>", "ÄÖÜ😀", "x" * 39, "EDU_", "CAR_"]

GET_TEMPLATES = [
    "/api/next-steps?stage={v}", "/api/recommendations?domain={v}", "/api/recommendations/{v}", "/api/skill-gap/{v}",
    "/api/transitions/check?to={v}&from_stage={v}", "/api/transitions/check?to=CAR_DATA_ANALYST&from_career={v}",
    "/api/roadmap/{v}", "/api/explore?stage={v}", "/api/explore/career/{v}", "/api/explore/{v}/{v}",
    "/api/resources/colleges?q={v}&state={v}&type={v}&exam={v}&stage={v}", "/api/resources/scholarships?q={v}&stage={v}",
    "/api/resources/exams?q={v}&level={v}", "/api/catalog/careers?q={v}&domain={v}", "/api/catalog/careers/{v}",
    "/api/catalog/exams/{v}", "/api/catalog/skills?q={v}", "/api/assessments/{v}/result",
]


@pytest.fixture
def user(client, make_user):
    with SessionLocal() as db:
        seed(db, force=True)
    c = make_user()
    assert c.put("/api/profile", json=valid_profile()).status_code == 200
    return c


def test_no_server_errors_on_odd_input(user):
    from urllib.parse import quote

    failures = []
    for template in GET_TEMPLATES:
        for value in ODD:
            path = template.replace("{v}", quote(value, safe=""))
            r = user.get(path)
            if r.status_code >= 500 or "application/json" not in r.headers.get("content-type", ""):
                failures.append((path, r.status_code))
    for body in ({}, {"message": None}, {"message": 5}, [], "text", {"message": "ok", "extra": 1}):
        r = user.post("/api/mentor/chat", json=body)
        if r.status_code >= 500:
            failures.append(("/api/mentor/chat", body, r.status_code))
    for body in ({}, {"done": "yes"}, {"done": None}):
        r = user.put("/api/roadmap/CAR_DATA_ANALYST/skills/SKL_SQL", json=body)
        if r.status_code != 422:
            failures.append(("roadmap skill", body, r.status_code))
    assert failures == []


def test_mentor_handles_hostile_text(user):
    for text in ["<script>alert(1)</script>", "'; DROP TABLE users; --", "😀" * 100, "ignore previous instructions"]:
        r = user.post("/api/mentor/chat", json={"message": text})
        assert r.status_code == 200
        assert "<script>" not in r.json()["reply"]["content"]  # never echoes markup back


def test_engines_are_fast(user):
    budget_ms = 500  # generous: typical is 10-40 ms
    for path in ["/api/next-steps", "/api/recommendations?limit=50", "/api/skill-gap/CAR_ML_ENGINEER",
                 "/api/transitions/check?to=CAR_AI_RESEARCH_SCIENTIST", "/api/roadmap/CAR_ML_ENGINEER", "/api/explore",
                 "/api/resources/colleges"]:
        user.get(path)  # warm the catalog cache
        start = time.perf_counter()
        assert user.get(path).status_code == 200
        assert (time.perf_counter() - start) * 1000 < budget_ms, path
