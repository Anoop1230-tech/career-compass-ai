"""Upcoming exams: public, no-login list of the next exam events, soonest first."""
import pytest

from catalog.seed import seed
from database import SessionLocal


@pytest.fixture
def seeded(client):
    with SessionLocal() as db:
        seed(db, force=True)
    return client


def test_upcoming_is_public_and_sorted(seeded):
    r = seeded.get("/api/exams/upcoming")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] > 0 and len(body["events"]) == body["total"]
    starts = [e["start"] for e in body["events"]]
    assert starts == sorted(starts)  # soonest first
    # Each row carries what the UI needs to show and to apply
    first = body["events"][0]
    for key in ("exam_id", "exam_name", "event", "label", "start", "end", "exact",
                "official_url", "conducting_body", "exam_level", "can_apply", "source_url"):
        assert key in first


def test_level_filter_returns_only_government_jobs(seeded):
    r = seeded.get("/api/exams/upcoming", params={"level": "government_job"})
    assert r.status_code == 200
    events = r.json()["events"]
    assert events and all(e["exam_level"] == "government_job" for e in events)
    # The government-job exams we added should show up
    assert {e["exam_id"] for e in events} & {"EXM_SSC_CGL", "EXM_IBPS_PO", "EXM_RRB_NTPC"}


def test_scope_filter_returns_only_state_exams(seeded):
    r = seeded.get("/api/exams/upcoming", params={"scope": "state"})
    assert r.status_code == 200
    events = r.json()["events"]
    assert events and all(e["exam_scope"] == "state" for e in events)
    # The regional/state exams we added (e.g. state police, state PSC) should show up
    assert {e["exam_id"] for e in events} & {
        "EXM_UP_POLICE_CONSTABLE", "EXM_BIHAR_POLICE_CONSTABLE", "EXM_UPPSC_PCS", "EXM_BPSC_PCS",
    }


def test_scope_is_reported_on_every_row(seeded):
    events = seeded.get("/api/exams/upcoming").json()["events"]
    assert all("exam_scope" in e for e in events)


def test_days_horizon_limits_how_far_ahead(seeded):
    near = seeded.get("/api/exams/upcoming", params={"days": 30}).json()
    far = seeded.get("/api/exams/upcoming", params={"days": 400}).json()
    assert near["total"] <= far["total"]


def test_exact_dates_link_to_the_official_site(seeded):
    events = seeded.get("/api/exams/upcoming").json()["events"]
    gate = [e for e in events if e["exam_id"] == "EXM_GATE" and e["exact"]]
    assert gate and all("gate2027.iitm.ac.in" in e["source_url"] for e in gate)
