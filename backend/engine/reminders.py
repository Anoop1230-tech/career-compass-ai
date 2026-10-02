"""Exam reminders: upcoming events for followed exams, a calendar (.ics) file, and due email reminders.

Two kinds of event:
- exact: dates the organiser has published (datasets/exam_dates.csv, each with its official source);
- indicative: the usual month from the exam's `typical_month` text ("May (indicative)"), used only when
  no exact exam date is published yet. Shown as "usually in <month>" and never as a firm date.
"""
import calendar
import re
from datetime import date, timedelta

MONTHS = {name.lower(): i for i, name in enumerate(calendar.month_name) if name}
MONTHS.update({name.lower(): i for i, name in enumerate(calendar.month_abbr) if name})
EVENT_LABELS = {
    "registration_opens": "Registration opens", "registration_closes": "Registration closes",
    "late_registration_closes": "Late registration closes", "admit_card": "Admit card",
    "exam": "Exam", "result": "Result", "usual_month": "Usually held",
}
REMIND_DAYS = 14  # email this many days before an event starts


def months_in(text: str) -> list[int]:
    """Month numbers named in free text, in order of appearance, without repeats."""
    found = []
    for word in re.findall(r"[A-Za-z]+", text or ""):
        m = MONTHS.get(word.lower())
        if m and m not in found:
            found.append(m)
    return found


def _next_month_window(month: int, today: date) -> tuple[date, date]:
    year = today.year if month >= today.month else today.year + 1
    return date(year, month, 1), date(year, month, calendar.monthrange(year, month)[1])


def exam_events(exam, dates: list, today: date) -> list[dict]:
    """Upcoming (not yet finished) events for one exam, soonest first."""
    events = [{"key": f"{d.date_id}", "exam_id": exam.exam_id, "exam_name": exam.name, "event": d.event,
               "start": d.start_date, "end": d.end_date, "exact": True, "source_url": d.source_url}
              for d in dates if d.end_date >= today]
    if not any(e["event"] == "exam" for e in events):
        for m in months_in(exam.typical_month):
            start, end = _next_month_window(m, today)
            events.append({"key": f"{exam.exam_id}:{start:%Y-%m}", "exam_id": exam.exam_id, "exam_name": exam.name,
                           "event": "usual_month", "start": start, "end": end, "exact": False,
                           "source_url": exam.official_url})
    return sorted(events, key=lambda e: (e["start"], e["key"]))


def serialize(event: dict) -> dict:
    return {**event, "start": event["start"].isoformat(), "end": event["end"].isoformat()}


def due(events: list[dict], today: date, already: set[str], days: int = REMIND_DAYS) -> list[dict]:
    """Events starting within `days` (or exact ones already running) that have not been emailed yet."""
    soon = today + timedelta(days=days)
    return [e for e in events if e["key"] not in already
            and (today <= e["start"] <= soon or (e["exact"] and e["start"] < today <= e["end"]))]


def _ics_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _fold(line: str) -> str:
    """RFC 5545: lines longer than 75 octets are folded with CRLF + space."""
    out, raw = [], line.encode("utf-8")
    while len(raw) > 75:
        cut = 75
        while cut and (raw[cut] & 0xC0) == 0x80:  # never split a UTF-8 character
            cut -= 1
        out.append(raw[:cut].decode("utf-8"))
        raw = b" " + raw[cut:]
    out.append(raw.decode("utf-8"))
    return "\r\n".join(out)


def ics(events: list[dict], stamp: date) -> str:
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Career Compass AI//Exam reminders//EN", "CALSCALE:GREGORIAN",
             "X-WR-CALNAME:Exam dates (Career Compass AI)"]
    for e in events:
        label = EVENT_LABELS.get(e["event"], e["event"])
        summary = f"{e['exam_name']}: {label}" + ("" if e["exact"] else " (usual month, not confirmed)")
        note = ("Date published by the organiser." if e["exact"] else
                "Indicative only: the exam is usually held this month. Check the official site for the exact date.")
        lines += ["BEGIN:VEVENT", f"UID:{e['key'].replace(':', '-')}@career-compass-ai", f"DTSTAMP:{stamp:%Y%m%d}T000000Z",
                  f"DTSTART;VALUE=DATE:{e['start']:%Y%m%d}", f"DTEND;VALUE=DATE:{e['end'] + timedelta(days=1):%Y%m%d}",
                  f"SUMMARY:{_ics_text(summary)}", f"DESCRIPTION:{_ics_text(note + ' ' + e['source_url'])}",
                  f"URL:{e['source_url']}", "TRANSP:TRANSPARENT", "END:VEVENT"]
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"


def email_body(name: str, events: list[dict], base_url: str) -> str:
    rows = []
    for e in events:
        label = EVENT_LABELS.get(e["event"], e["event"])
        when = (f"{e['start']:%d %b %Y}" + (f" to {e['end']:%d %b %Y}" if e["end"] != e["start"] else "")
                if e["exact"] else f"usually in {e['start']:%B %Y} (not confirmed)")
        rows.append(f"- {e['exam_name']}: {label}, {when}\n  Official site: {e['source_url']}")
    return (f"Hello{(' ' + name) if name else ''},\n\nComing up for the exams you follow:\n\n" + "\n".join(rows) +
            "\n\nDates can change; always check the official site.\n"
            f"Manage your exams or stop these emails: {base_url}/dashboard\n")
