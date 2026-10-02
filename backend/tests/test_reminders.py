"""Phase 27: exam reminders (follow, coming up, calendar file, email job)."""
from datetime import date
from types import SimpleNamespace

import pytest

from catalog.seed import seed
from database import SessionLocal
from engine.reminders import _fold, due, exam_events, months_in
from services import mailer
from services.reminders import run


@pytest.fixture
def user(client, make_user):
    with SessionLocal() as db:
        seed(db, force=True)
    return make_user()


@pytest.fixture
def outbox(monkeypatch):
    sent = []
    monkeypatch.setattr(mailer, "outbox", sent)
    return sent


def test_months_in_text():
    assert months_in("Prelims usually in May or June (indicative)") == [5, 6]
    assert months_in("January and April (indicative)") == [1, 4]
    assert months_in("Check official calendar") == [] and months_in("Book any time") == []


def test_indicative_month_rolls_to_next_year():
    exam = SimpleNamespace(exam_id="EXM_X", name="X", typical_month="May (indicative)", official_url="https://x.gov.in/")
    [e] = exam_events(exam, [], date(2026, 10, 3))
    assert (e["start"], e["end"], e["exact"]) == (date(2027, 5, 1), date(2027, 5, 31), False)


def test_exact_dates_replace_the_usual_month():
    exam = SimpleNamespace(exam_id="EXM_G", name="G", typical_month="February", official_url="https://g.ac.in/")
    d = SimpleNamespace(date_id="ED_1", event="exam", start_date=date(2027, 2, 6), end_date=date(2027, 2, 21),
                        source_url="https://g.ac.in/dates")
    past = SimpleNamespace(date_id="ED_0", event="registration_closes", start_date=date(2026, 9, 1),
                           end_date=date(2026, 9, 1), source_url="https://g.ac.in/dates")
    events = exam_events(exam, [past, d], date(2026, 10, 3))
    assert [e["key"] for e in events] == ["ED_1"] and events[0]["exact"]


def test_due_window_and_already_sent():
    e = {"key": "K", "start": date(2026, 10, 10), "end": date(2026, 10, 10), "exact": True}
    assert due([e], date(2026, 10, 1), set()) == [e]
    assert due([e], date(2026, 9, 1), set()) == []
    assert due([e], date(2026, 10, 1), {"K"}) == []


def test_ics_lines_are_folded():
    line = "SUMMARY:" + "परीक्षा " * 30
    assert all(len(part.encode()) <= 76 for part in _fold(line).split("\r\n"))


def test_follow_list_calendar_unfollow(user):
    assert user.get("/api/reminders").json() == {"exams": [], "events": []}
    body = user.put("/api/reminders/EXM_GATE").json()
    assert body["exams"][0]["exam_id"] == "EXM_GATE" and body["exams"][0]["has_exact_dates"]
    assert all(e["exact"] and "gate2027.iitm.ac.in" in e["source_url"] for e in body["events"])
    user.put("/api/reminders/EXM_NEET_UG", json={"email": False})
    body = user.get("/api/reminders").json()
    neet = next(x for x in body["exams"] if x["exam_id"] == "EXM_NEET_UG")
    assert neet["email"] is False
    assert any(e["exam_id"] == "EXM_NEET_UG" and not e["exact"] for e in body["events"])
    starts = [e["start"] for e in body["events"]]
    assert starts == sorted(starts)

    cal = user.get("/api/reminders/calendar.ics")
    assert cal.status_code == 200 and cal.headers["content-type"].startswith("text/calendar")
    assert cal.text.startswith("BEGIN:VCALENDAR\r\n") and "SUMMARY:GATE: Exam" in cal.text

    assert user.delete("/api/reminders/EXM_GATE").status_code == 204
    assert [x["exam_id"] for x in user.get("/api/reminders").json()["exams"]] == ["EXM_NEET_UG"]


def test_unknown_exam_and_login_required(client, user):
    r = user.put("/api/reminders/EXM_NOPE")
    assert r.status_code == 404 and r.json()["code"] == "exam.not_found"
    user.post("/api/auth/logout")
    assert client.get("/api/reminders").status_code == 401
    assert client.get("/api/reminders/calendar.ics").status_code == 401


def test_reminder_job_sends_once_and_respects_opt_out(user, outbox):
    user.put("/api/reminders/EXM_GATE")
    user.put("/api/reminders/EXM_CAT", json={"email": False})
    with SessionLocal() as db:
        assert run(db, today=date(2026, 12, 25)) == {"users": 1, "sent": 1, "failed": 0}
    assert len(outbox) == 1
    text = outbox[0].get_content()
    assert "GATE: Admit card, 04 Jan 2027" in text and "CAT" not in text and "/dashboard" in text
    with SessionLocal() as db:
        assert run(db, today=date(2026, 12, 26))["sent"] == 0  # already reminded
        assert run(db, today=date(2027, 1, 30))["sent"] == 1  # the exam itself
    assert len(outbox) == 2
