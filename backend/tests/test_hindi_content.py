"""Phase 29: Hindi catalog content and Hindi mentor (draft text, English fallback)."""
import pytest

from catalog.seed import seed
from database import SessionLocal
from services.lang import request_lang
from tests.conftest import valid_profile

HI = {"Accept-Language": "hi"}


@pytest.fixture
def api(client):
    with SessionLocal() as db:
        seed(db, force=True)
    return client


@pytest.mark.parametrize("header,lang", [("hi", "hi"), ("hi-IN,en;q=0.8", "hi"), ("en-US", "en"), ("fr, hi;q=0.5", "hi"),
                                         ("fr", "en"), ("", "en")])
def test_request_lang(header, lang):
    class R:
        headers = {"accept-language": header}
    assert request_lang(R()) == lang


def test_career_list_and_detail_in_hindi_with_english_fallback(api):
    en = api.get("/api/catalog/careers", params={"limit": 100}).json()["items"]
    hi = api.get("/api/catalog/careers", params={"limit": 100}, headers=HI).json()["items"]
    assert len(en) == len(hi) == 100
    by_id = {c["career_id"]: c for c in hi}
    assert by_id["CAR_DOCTOR_MBBS"]["name"] == "डॉक्टर (MBBS)"
    assert next(c for c in en if c["career_id"] == "CAR_DOCTOR_MBBS")["name"] == "Doctor (MBBS)"
    assert all(any("\u0900" <= ch <= "\u097f" for ch in c["name"]) for c in hi)  # every career has a Hindi name

    detail = api.get("/api/catalog/careers/CAR_DATA_SCIENTIST", headers=HI).json()
    assert detail["name"] == "डेटा साइंटिस्ट" and "मशीन लर्निंग" in detail["description"]
    assert any(s["name"].startswith("B.Tech – कंप्यूटर") for s in detail["typical_stages"])
    # Skills have no Hindi rows yet: English stays
    assert any(s["name"] == "Python" for s in detail["skills"])


def test_search_finds_hindi_names(api):
    items = api.get("/api/catalog/careers", params={"q": "वकील"}, headers=HI).json()["items"]
    assert "CAR_LAWYER" in {c["career_id"] for c in items}


def test_exams_and_stages_in_hindi(api):
    exams = {e["exam_id"]: e for e in api.get("/api/catalog/exams", headers=HI).json()}
    assert exams["EXM_NEET_UG"]["purpose"].startswith("MBBS, BDS")
    res = api.get("/api/resources/exams", params={"q": "NEET"}, headers=HI).json()["items"]
    assert any("दाखिला" in e["purpose"] for e in res)
    stages = {s["stage_id"]: s["name"] for s in api.get("/api/catalog/stages", headers=HI).json()}
    assert stages["EDU_CLASS_10"] == "कक्षा 10" and stages["EDU_BCA"] == "BCA"  # untranslated -> English


def test_recommendations_use_hindi_names(api, make_user):
    c = make_user()
    c.put("/api/profile", json=valid_profile())
    items = c.get("/api/recommendations", headers=HI).json()["items"]
    assert items and all(any("\u0900" <= ch <= "\u097f" for ch in i["name"]) for i in items)


def ask(c, message, headers=HI) -> dict:
    reply = c.post("/api/mentor/chat", json={"message": message}, headers=headers).json()["reply"]
    return {**reply, "text": reply["content"]}


def test_mentor_understands_and_answers_in_hindi(api, make_user):
    c = make_user()
    c.put("/api/profile", json=valid_profile())
    hello = ask(c, "नमस्ते")
    assert hello["text"].startswith("नमस्ते") and all(any("\u0900" <= ch <= "\u097f" for ch in s) for s in hello["suggestions"])
    r = ask(c, "मेरे लिए कौन सी छात्रवृत्ति है?")
    assert r["intent"] == "scholarships"
    r = ask(c, "क्या मैं डेटा साइंटिस्ट बन सकता हूँ?")
    assert r["intent"] == "transition" and r["career_id"] == "CAR_DATA_SCIENTIST"
    r = ask(c, "वकील")
    assert r["intent"] == "career" and r["text"].startswith("अधिवक्ता (वकील):")
    # "क्या" contains "या" but must not be read as "or"
    r = ask(c, "क्या")
    assert r["intent"] == "fallback" and "समझ नहीं" in r["text"]
    # English stays English
    assert ask(c, "hello", headers={})["text"].startswith("Hi")
    hist = c.get("/api/mentor/history", headers=HI).json()
    assert hist["suggestions"][0].startswith("आगे")
