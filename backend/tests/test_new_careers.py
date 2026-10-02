"""Phase 21: healthcare, law, defence, agriculture and ITI trades are browsable and reachable."""
import pytest

from catalog.seed import seed
from database import SessionLocal


@pytest.fixture
def api(client):
    with SessionLocal() as db:
        seed(db, force=True)
    return client

NEW = {
    "Healthcare": {"CAR_DOCTOR_MBBS", "CAR_SPECIALIST_DOCTOR", "CAR_NURSE", "CAR_PHARMACIST", "CAR_MEDICAL_LAB_TECH"},
    "Law": {"CAR_LAWYER", "CAR_CORPORATE_LAWYER", "CAR_JUDGE", "CAR_LEGAL_ANALYST"},
    "Defence": {"CAR_ARMED_FORCES_OFFICER", "CAR_AIR_FORCE_PILOT", "CAR_SOLDIER"},
    "Agriculture": {"CAR_AGRI_OFFICER", "CAR_AGRI_SCIENTIST", "CAR_AGRI_ENTREPRENEUR"},
    "Skilled Trades": {"CAR_ELECTRICIAN", "CAR_FITTER_MACHINIST", "CAR_WELDER", "CAR_AUTO_MECHANIC", "CAR_PLUMBER"},
}


def test_new_fields_are_listed(api):
    data = api.get("/api/catalog/careers", params={"limit": 100}).json()
    assert set(NEW) <= set(data["domains"])
    ids = {c["career_id"] for c in data["items"]}
    for careers in NEW.values():
        assert careers <= ids


def test_doctor_detail_shows_neet_route(api):
    c = api.get("/api/catalog/careers/CAR_DOCTOR_MBBS").json()
    assert c["domain"] == "Healthcare"
    assert any(p["from_stage_id"] == "EDU_MBBS" for p in c["entry_paths"])
    assert any(s["is_mandatory"] for s in c["skills"])
    assert any(n["career_id"] == "CAR_SPECIALIST_DOCTOR" for n in c["next_careers"])


def test_pcb_student_sees_mbbs_with_neet(api):
    text = str(api.get("/api/next-steps", params={"stage": "EDU_12_PCB"}).json())
    assert "EDU_MBBS" in text and "EXM_NEET_UG" in text and "CAR_MEDICAL_LAB_TECH" in text


def test_class_10_can_reach_iti_trades_and_agniveer(api):
    text = str(api.get("/api/next-steps", params={"stage": "EDU_CLASS_10"}).json())
    assert "EDU_ITI" in text and "EXM_AGNIVEER" in text
    text = str(api.get("/api/next-steps", params={"stage": "EDU_ITI"}).json())
    for cid in NEW["Skilled Trades"]:
        assert cid in text


def test_dream_check_humanities_to_lawyer(api):
    r = api.get("/api/transitions/check", params={"from_stage": "EDU_12_HUMANITIES", "to": "CAR_LAWYER"})
    assert r.status_code == 200
    body = r.json()
    assert body["verdict"] in ("direct", "achievable")
    assert "EDU_LLB_5YR" in str(body["education_route"])


def test_interests_and_goals_point_at_new_fields():
    from engine.context import UserContext
    from engine.fit import goal_matches_career, interest_matches
    from types import SimpleNamespace

    ctx = UserContext()
    ctx.interests = ["healthcare", "law", "defence", "agriculture"]
    ctx.goals = ["government_career", "entrepreneurship"]
    career = lambda cid, domain, sub: SimpleNamespace(career_id=cid, domain=domain, sub_domain=sub, work_style=[])  # noqa: E731
    assert interest_matches(ctx, career("CAR_NURSE", "Healthcare", "Nursing")) == ["healthcare"]
    assert interest_matches(ctx, career("CAR_JUDGE", "Law", "Judiciary")) == ["law"]
    assert "government_career" in goal_matches_career(ctx, career("CAR_SOLDIER", "Defence", "Other Ranks"))
    assert "government_career" in goal_matches_career(ctx, career("CAR_JUDGE", "Law", "Judiciary"))
    assert "entrepreneurship" in goal_matches_career(ctx, career("CAR_AGRI_ENTREPRENEUR", "Agriculture", "Agribusiness"))


def test_mentor_recognises_new_careers():
    from engine.mentor import CAREER_ALIASES, STAGE_ALIASES
    assert CAREER_ALIASES["doctor"] == "CAR_DOCTOR_MBBS"
    assert CAREER_ALIASES["electrician"] == "CAR_ELECTRICIAN"
    assert STAGE_ALIASES["iti"] == "EDU_ITI"
