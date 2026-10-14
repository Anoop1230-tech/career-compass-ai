"""Career Mentor: intent routing, grounding, API, privacy, rate limit and LLM fallback."""
import pytest

from catalog.seed import seed
from database import SessionLocal
from engine.catalog_data import get_catalog
from engine.context import StageGuess, UserContext
from engine.mentor import answer, find_careers, find_exam, find_stage
from routes.mentor import mentor_limiter
from services import llm
from tests.conftest import valid_profile


@pytest.fixture
def catalog():
    with SessionLocal() as db:
        seed(db, force=True)
        yield get_catalog(db)


@pytest.fixture
def api(client):
    with SessionLocal() as db:
        seed(db, force=True)
    return client


CTX = UserContext(has_profile=True, name="Asha Verma", stage=StageGuess("EDU_BTECH_CSE", True, ""),
                  skills={"SKL_PYTHON": 3, "SKL_SQL": 2}, goals=["job"], interests=["technology"])


def ask(catalog, q, ctx=CTX, **kw):
    with SessionLocal() as db:
        return answer(catalog, ctx, q, db, **kw)


def test_entity_extraction(catalog):
    assert find_careers(catalog, "Can I become a singer?") == ["CAR_SINGER"]
    assert find_careers(catalog, "I love poetry and stand up comedy") == ["CAR_POET_LYRICIST", "CAR_STANDUP_COMEDIAN"]
    assert find_careers(catalog, "how to become a fashion designer") == ["CAR_FASHION_DESIGNER"]
    assert find_careers(catalog, "Can I become a Data Scientist?") == ["CAR_DATA_SCIENTIST"]
    assert find_careers(catalog, "compare data analyst vs data scientist") == ["CAR_DATA_ANALYST", "CAR_DATA_SCIENTIST"]
    assert find_careers(catalog, "I want to be an ethical hacker") == ["CAR_PENETRATION_TESTER"]
    assert find_careers(catalog, "hello there") == []
    assert find_stage("what after 12th PCM") == "EDU_12_PCM"
    assert find_stage("I am doing B.Tech") == "EDU_BTECH_CSE"
    assert find_exam(catalog, "tell me about jee main") == "EXM_JEE_MAIN"
    assert find_exam(catalog, "is GATE hard") == "EXM_GATE"


@pytest.mark.parametrize("question, intent", [
    ("hi", "greeting"),
    ("What should I do next?", "next_steps"),
    ("I'm confused about my future", "next_steps"),
    ("Which careers suit me?", "recommend"),
    ("Can I become a data scientist?", "transition"),
    ("what skills do I need for cloud engineer", "skills"),
    ("roadmap for ML engineer", "roadmap"),
    ("how do I become a product manager", "roadmap"),
    ("which exams should I take", "exams"),
    ("tell me about GATE", "exam"),
    ("any scholarships for me?", "scholarships"),
    ("good colleges for mtech", "colleges"),
    ("compare data analyst and data scientist", "compare"),
    ("what is the salary of a data scientist", "salary"),
    ("tell me about DevOps Engineer", "career"),
    ("asdfgh qwerty", "fallback"),
])
def test_intents(catalog, question, intent):
    reply = ask(catalog, question)
    assert reply.intent == intent
    assert reply.text and len(reply.text) < 2500
    for a in reply.actions:
        assert a["link"].startswith(("/", "https://"))


def test_answers_are_grounded_and_personal(catalog):
    nxt = ask(catalog, "What should I do next?").text
    assert "B.Tech – Computer Science" in nxt and "GATE" in nxt
    skills = ask(catalog, "what skills do I need for data scientist")
    assert "Python" in skills.text  # already has it
    assert skills.career_id == "CAR_DATA_SCIENTIST"
    # Never invents salaries
    salary = ask(catalog, "how much does a software engineer earn").text
    assert "don't give salary numbers" in salary and "₹" not in salary and "lakh" not in salary.lower()
    # From school, a dream career gets the study route
    route = ask(catalog, "Can I become a software engineer after 12th pcm?").text
    assert "B.Tech – Computer Science" in route and "JEE Main" in route


def test_follow_up_uses_remembered_career(catalog):
    reply = ask(catalog, "what skills should I learn first?", remembered_career="CAR_CLOUD_ENGINEER")
    assert reply.intent == "skills" and reply.career_id == "CAR_CLOUD_ENGINEER"


def test_no_profile_is_handled(catalog):
    empty = UserContext()
    assert ask(catalog, "Which careers suit me?", ctx=empty).intent == "need_profile"
    assert ask(catalog, "What should I do next?", ctx=empty).intent == "need_profile"
    # General questions still work
    assert ask(catalog, "tell me about GATE", ctx=empty).intent == "exam"


def test_api_chat_history_and_privacy(api, make_user):
    assert api.post("/api/mentor/chat", json={"message": "hi"}).status_code == 401
    alice = make_user("alice@example.com")
    alice.put("/api/profile", json=valid_profile())
    body = alice.post("/api/mentor/chat", json={"message": "Can I become a data scientist?"}).json()
    assert body["message"]["role"] == "user" and body["reply"]["role"] == "mentor"
    assert body["reply"]["intent"] == "transition" and body["reply"]["source"] == "local"
    # Follow-up without naming the career
    follow = alice.post("/api/mentor/chat", json={"message": "what skills should I learn?"}).json()["reply"]
    assert follow["career_id"] == "CAR_DATA_SCIENTIST"
    history = alice.get("/api/mentor/history").json()
    assert [m["role"] for m in history["messages"]] == ["user", "mentor", "user", "mentor"]
    assert history["llm_enabled"] is False
    alice.post("/api/auth/logout")

    bob = make_user("bob@example.com")
    assert bob.get("/api/mentor/history").json()["messages"] == []
    assert bob.post("/api/mentor/chat", json={"message": "   "}).status_code == 422
    assert bob.post("/api/mentor/chat", json={"message": "x" * 501}).status_code == 422
    assert bob.delete("/api/mentor/history").status_code == 204


@pytest.mark.parametrize("question, needle", [
    ("how do I prepare to study abroad?", "abroad"),
    ("any tips for my interview", "interview"),
    ("how do I make a good resume", "resume"),
    ("I feel very stressed and anxious about my career", "alone"),
    ("how do I manage my time and stop procrastinating", "routine"),
    ("I can't afford the fees, what about loans", "Scholarships"),
])
def test_topical_guidance_for_open_questions(catalog, question, needle):
    reply = ask(catalog, question)
    assert reply.intent == "guidance"
    assert needle.lower() in reply.text.lower()
    assert reply.text and len(reply.text) < 2500
    for a in reply.actions:
        assert a["link"].startswith(("/", "https://"))


def test_pure_gibberish_still_falls_back(catalog):
    assert ask(catalog, "asdfgh qwerty zxcvb").intent == "fallback"


def test_llm_answers_open_questions_when_configured(api, make_user, monkeypatch):
    client = make_user()
    client.put("/api/profile", json=valid_profile())
    for k in ("LLM_API_URL", "LLM_API_KEY", "LLM_MODEL"):
        monkeypatch.setenv(k, "https://llm.invalid/v1/chat/completions" if k == "LLM_API_URL" else "x")
    sent = {}

    class Ok:
        def raise_for_status(self):
            pass

        def json(self):
            return {"choices": [{"message": {"content": "Here is a thoughtful answer."}}]}

    async def fake_post(url, headers, json, timeout):
        sent.update(json)
        return Ok()

    monkeypatch.setattr(llm, "_post", fake_post)
    # A question the engine cannot ground -> the model answers it directly
    reply = client.post("/api/mentor/chat", json={"message": "what do you think about the stock market today"}).json()["reply"]
    assert reply["content"] == "Here is a thoughtful answer." and reply["source"] == "llm"
    prompt = sent["messages"][1]["content"]
    assert "user@example.com" not in prompt and "DRAFT" not in prompt  # answer path, not rephrase, no email

    # Without a provider, the same question gives the helpful local fallback
    for k in ("LLM_API_URL", "LLM_API_KEY", "LLM_MODEL"):
        monkeypatch.delenv(k, raising=False)
    local = client.post("/api/mentor/chat", json={"message": "what do you think about the stock market today"}).json()["reply"]
    assert local["source"] == "local" and local["content"]


def test_rate_limit(api, make_user, monkeypatch):
    client = make_user()
    monkeypatch.setattr(mentor_limiter, "limit", 2)
    for _ in range(2):
        assert client.post("/api/mentor/chat", json={"message": "hi"}).status_code == 200
    assert client.post("/api/mentor/chat", json={"message": "hi"}).status_code == 429


def test_llm_is_used_when_configured_and_falls_back(api, make_user, monkeypatch):
    client = make_user()
    client.put("/api/profile", json=valid_profile())
    for k in ("LLM_API_URL", "LLM_API_KEY", "LLM_MODEL"):
        monkeypatch.setenv(k, "x" if k != "LLM_API_URL" else "https://llm.invalid/v1/chat/completions")
    sent = {}

    class Ok:
        def raise_for_status(self):
            pass

        def json(self):
            return {"choices": [{"message": {"content": "Friendly rewrite."}}]}

    async def fake_post(url, headers, json, timeout):
        sent.update(json)
        return Ok()

    monkeypatch.setattr(llm, "_post", fake_post)
    reply = client.post("/api/mentor/chat", json={"message": "What should I do next?"}).json()["reply"]
    assert reply["content"] == "Friendly rewrite." and reply["source"] == "llm"
    prompt = sent["messages"][1]["content"]
    assert "user@example.com" not in prompt and "DRAFT" in prompt  # no email sent

    async def broken(*a, **kw):
        raise llm.httpx.ConnectError("down")

    monkeypatch.setattr(llm, "_post", broken)
    reply = client.post("/api/mentor/chat", json={"message": "What should I do next?"}).json()["reply"]
    assert reply["source"] == "local" and "B.Tech" in reply["content"]



def test_slow_llm_does_not_block_other_requests(api, make_user, monkeypatch):
    """While the mentor waits for the language model, the server keeps answering."""
    import asyncio
    import threading
    import time

    client = make_user()
    client.put("/api/profile", json=valid_profile())
    for k in ("LLM_API_URL", "LLM_API_KEY", "LLM_MODEL"):
        monkeypatch.setenv(k, "https://llm.invalid/v1" if k == "LLM_API_URL" else "x")
    started = threading.Event()

    async def slow_post(*a, **kw):
        started.set()
        await asyncio.sleep(1.5)
        raise llm.httpx.ConnectError("timeout")

    monkeypatch.setattr(llm, "_post", slow_post)
    result = {}
    worker = threading.Thread(target=lambda: result.update(
        r=client.post("/api/mentor/chat", json={"message": "What should I do next?"})))
    worker.start()
    assert started.wait(10)
    t0 = time.monotonic()
    assert client.get("/api/health").status_code == 200
    assert time.monotonic() - t0 < 1.0  # answered while the LLM call was still waiting
    worker.join(10)
    assert result["r"].json()["reply"]["source"] == "local"
