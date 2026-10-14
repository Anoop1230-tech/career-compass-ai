"""Recommendation Engine: signal maths, ranking sanity checks and the API."""
import pytest

from catalog.seed import seed
from database import SessionLocal
from engine.catalog_data import get_catalog
from engine.context import StageGuess, UserContext
from engine.recommend import WEIGHTS, confidence, reachable_careers, recommend, score_career
from tests.conftest import valid_profile

INTEREST_ALL = {"R": 50, "I": 50, "A": 50, "S": 50, "E": 50, "C": 50}


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


def ctx(stage=None, **kw):
    return UserContext(has_profile=True, stage=StageGuess(stage, True, ""), **kw)


def top(catalog, context, n=3, **kw):
    return [i["career_id"] for i in recommend(catalog, context, limit=n, **kw)["items"]]


def test_weights_sum_to_100():
    assert sum(WEIGHTS.values()) == 100


def test_reachability_follows_study_steps(catalog):
    reach = reachable_careers(catalog, "EDU_BCA")
    assert reach["CAR_SOFTWARE_ENGINEER"] == 1  # direct
    school = reachable_careers(catalog, "EDU_12_PCM")
    assert school["CAR_SOFTWARE_ENGINEER"] == 2  # PCM -> B.Tech -> job
    assert reachable_careers(catalog, None) == {}


def test_score_is_weighted_average_of_available_signals(catalog):
    c = ctx("EDU_BTECH_CSE", riasec={"R": 0, "I": 100, "A": 0, "S": 0, "E": 0, "C": 100})
    item = score_career(catalog, c, catalog.careers["CAR_DATA_SCIENTIST"], reachable_careers(catalog, "EDU_BTECH_CSE"))
    parts = {p["key"]: p for p in item["components"]}
    assert parts["interest"]["score"] == 100  # I and C are the career's codes
    assert parts["education"]["score"] == 100
    assert not parts["aptitude"]["available"] and parts["aptitude"]["contribution"] == 0
    # Only interest + education are known -> both 100 -> 100
    assert item["score"] == 100
    assert sum(p["contribution"] for p in item["components"]) == pytest.approx(item["score"], abs=0.2)


def test_profiles_get_sensible_top_careers(catalog):
    data = ctx("EDU_BTECH_CSE", skills={"SKL_PYTHON": 3, "SKL_SQL": 2, "SKL_STATISTICS": 2, "SKL_PANDAS": 2},
               interests=["technology"], riasec={"R": 30, "I": 90, "A": 40, "S": 30, "E": 20, "C": 70},
               aptitude={"numerical": 80, "logical": 85, "verbal": 50, "spatial": 40, "problem_solving": 75})
    assert {"CAR_DATA_ANALYST", "CAR_DATA_SCIENTIST"} & set(top(catalog, data))

    commerce = ctx("EDU_BCOM", skills={"SKL_EXCEL": 3}, interests=["finance"],
                   riasec={"R": 20, "I": 40, "A": 30, "S": 40, "E": 70, "C": 90})
    assert set(top(catalog, commerce, 2)) <= {"CAR_ACCOUNTANT", "CAR_FINANCIAL_ANALYST", "CAR_BUSINESS_ANALYST"}

    public = ctx("EDU_BA", interests=["government"], goals=["government_career"],
                 riasec={"R": 10, "I": 30, "A": 60, "S": 95, "E": 60, "C": 40})
    assert top(catalog, public, 1) == ["CAR_CIVIL_SERVICES"]

    design = ctx("EDU_BTECH_CSE", skills={"SKL_FIGMA": 2}, interests=["design"],
                 riasec={"R": 10, "I": 50, "A": 95, "S": 60, "E": 40, "C": 20})
    assert top(catalog, design, 1) == ["CAR_UI_UX_DESIGNER"]


def test_creative_profiles_get_creative_careers(catalog):
    """A B.Tech student who sings, dances or does comedy sees those careers ranked first, not only tech jobs."""
    artistic = {"R": 20, "I": 30, "A": 95, "S": 70, "E": 70, "C": 10}
    singer = ctx("EDU_BTECH_CSE", skills={"SKL_SINGING": 3, "SKL_MUSIC_THEORY": 2}, interests=["music"], riasec=artistic)
    assert top(catalog, singer, 1) == ["CAR_SINGER"]

    dancer = ctx("EDU_BTECH_CSE", skills={"SKL_DANCE": 3, "SKL_STAGE_PERFORMANCE": 2}, interests=["dance"], riasec=artistic)
    assert set(top(catalog, dancer, 2)) == {"CAR_DANCER", "CAR_CHOREOGRAPHER"}

    comic = ctx("EDU_BTECH_CSE", skills={"SKL_COMEDY": 2, "SKL_STAGE_PERFORMANCE": 2, "SKL_CREATIVE_WRITING": 2},
                interests=["performing_arts"], riasec=artistic)
    assert top(catalog, comic, 1) == ["CAR_STANDUP_COMEDIAN"]

    poet = ctx("EDU_12_HUMANITIES", skills={"SKL_POETRY": 3, "SKL_CREATIVE_WRITING": 2}, interests=["writing"],
               riasec=artistic)
    assert top(catalog, poet, 1) == ["CAR_POET_LYRICIST"]

    # someone who left after Class 10 and loves cooking
    cook = ctx("EDU_CLASS_10", skills={"SKL_COOKING": 2}, interests=["cooking"],
               riasec={"R": 90, "I": 20, "A": 60, "S": 50, "E": 60, "C": 30})
    assert top(catalog, cook, 1) == ["CAR_CHEF"]


def test_creative_careers_reachable_from_every_starting_stage(catalog):
    for stage in ("EDU_CLASS_10", "EDU_12_PCM", "EDU_BTECH_CSE", "EDU_BCOM", "EDU_WORKING_NONTECH"):
        reach = reachable_careers(catalog, stage)
        for career in ("CAR_SINGER", "CAR_DANCER", "CAR_GRAPHIC_DESIGNER", "CAR_POET_LYRICIST",
                       "CAR_STANDUP_COMEDIAN", "CAR_PHOTOGRAPHER", "CAR_CHEF"):
            assert reach[career] == 2, (stage, career)  # stage -> professional course -> career


def test_each_signal_moves_the_score_the_right_way(catalog):
    reach = reachable_careers(catalog, "EDU_BTECH_CSE")
    career = catalog.careers["CAR_ML_ENGINEER"]
    base = dict(riasec=INTEREST_ALL)

    def score(**kw):
        return score_career(catalog, ctx("EDU_BTECH_CSE", **{**base, **kw}), career, reach)["score"]

    assert score(skills={"SKL_ML": 3, "SKL_PYTHON": 3, "SKL_DL": 3}) > score(skills={"SKL_EXCEL": 1})
    assert score(aptitude={"numerical": 90, "logical": 90, "problem_solving": 90}) > \
        score(aptitude={"numerical": 10, "logical": 10, "problem_solving": 10})
    assert score(riasec={"R": 70, "I": 95, "A": 10, "S": 10, "E": 10, "C": 80}) > \
        score(riasec={"R": 10, "I": 10, "A": 90, "S": 90, "E": 90, "C": 10})
    # Education: a stage that cannot reach the career scores lower
    far = score_career(catalog, ctx("EDU_BA", riasec=INTEREST_ALL), career, reachable_careers(catalog, "EDU_BA"))
    assert far["score"] < score()


def test_explanations_and_skill_hints(catalog):
    item = recommend(catalog, ctx("EDU_BTECH_CSE", skills={"SKL_PYTHON": 3}, riasec=INTEREST_ALL,
                                  interests=["technology"]), limit=50)["items"]
    ds = next(i for i in item if i["career_id"] == "CAR_DATA_SCIENTIST")
    assert ds["strengths"] and all(isinstance(s, str) for s in ds["strengths"])
    assert "Statistics" in ds["skills_to_learn"]
    assert any("Python" in c["explanation"] for c in ds["components"] if c["key"] == "skills")


def test_confidence_and_empty_profile(catalog):
    empty = ctx(None)
    assert confidence(empty)["percent"] == 0
    assert recommend(catalog, empty)["items"] == []
    full = ctx("EDU_BTECH_CSE", skills={"SKL_PYTHON": 1}, riasec=INTEREST_ALL, aptitude={"logical": 50},
               personality={"team_orientation": 50}, interests=["technology"])
    assert confidence(full) == {"percent": 100, "level": "high", "signals": {k: True for k in WEIGHTS}, "improve": []}
    tips = {t["key"] for t in confidence(ctx("EDU_BCA"))["improve"]}
    assert tips == {"interest", "skills"}


def test_domain_filter(catalog):
    items = recommend(catalog, ctx("EDU_BCOM", interests=["finance"]), domain="Finance", limit=50)["items"]
    assert items and {i["domain"] for i in items} == {"Finance"}


# ---------------------------------------------------------------- API
def test_api_requires_login_and_profile(api, make_user):
    assert api.get("/api/recommendations").status_code == 401
    client = make_user()
    response = client.get("/api/recommendations")
    assert response.status_code == 404 and "profile" in response.json()["detail"]


def test_api_returns_ranked_explained_list(api, make_user):
    client = make_user()
    client.put("/api/profile", json=valid_profile())
    body = client.get("/api/recommendations?limit=5").json()
    assert len(body["items"]) == 5 and body["total"] == 100
    scores = [i["score"] for i in body["items"]]
    assert scores == sorted(scores, reverse=True)
    assert body["stage"]["stage_id"] == "EDU_BTECH_CSE"
    assert body["confidence"]["level"] in {"low", "medium", "high"}
    tip_keys = {t["key"] for t in body["confidence"]["improve"]}
    assert "interest" in tip_keys and not tip_keys & {"aptitude", "personality"}
    first = body["items"][0]
    assert len(first["components"]) == 6 and first["strengths"]

    one = client.get(f"/api/recommendations/{first['career_id']}").json()
    assert one["rank"] == 1 and one["out_of"] == 100 and one["score"] == first["score"]
    assert client.get("/api/recommendations/CAR_NOPE").status_code == 404
    assert client.get("/api/recommendations?limit=0").status_code == 422


def test_api_uses_assessment_results(api, make_user):
    client = make_user()
    client.put("/api/profile", json=valid_profile())
    before = client.get("/api/recommendations").json()["confidence"]["percent"]
    start = client.post("/api/assessments/interest/start").json()
    answers = {q["question_id"]: 5 for q in start["questions"]}
    # Differentiated answers so the result is usable (half high, half low)
    for i, q in enumerate(start["questions"]):
        answers[q["question_id"]] = 5 if i < len(start["questions"]) // 2 else 1
    assert client.post("/api/assessments/interest/submit",
                       json={"attempt_id": start["attempt_id"], "answers": answers}).status_code == 200
    after = client.get("/api/recommendations").json()
    assert after["confidence"]["percent"] > before
    assert after["items"][0]["components"][0]["available"] is True  # interest signal now used


def test_quick_profile_minimal_fields_give_branch_results(api, make_user):
    """The 60-second profile sends only name, stage, degree, branch and interests."""
    client = make_user()
    body = {"full_name": "Asha Verma", "current_stage": "ug_student",
            "education": {"degree": "B.Tech", "branch": "Civil"}, "interests": ["engineering"]}
    assert client.put("/api/profile", json=body).status_code in (200, 201)
    rec = client.get("/api/recommendations?limit=10").json()
    assert rec["stage"]["stage_id"] == "EDU_BTECH_CIVIL"
    assert "CAR_CIVIL_ENGINEER" in {i["career_id"] for i in rec["items"]}
