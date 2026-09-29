"""Next Step Engine: stage mapping, skill matching, ranking and the API."""
import pytest

from catalog.seed import seed
from database import SessionLocal
from engine.catalog_data import get_catalog
from engine.context import UserContext, guess_stage, match_career, match_skill
from engine.next_steps import UnknownStage, next_steps
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


# ---------------------------------------------------------------- stage mapping
@pytest.mark.parametrize("stage, education, role, expected, exact", [
    ("not_studying", {}, None, "EDU_CLASS_10", False),
    ("not_studying", {"stream": "humanities"}, None, "EDU_12_HUMANITIES", False),
    ("not_studying", {"degree": "B.Tech", "branch": "Computer Science"}, None, "EDU_BTECH_CSE", True),
    ("class_10", {}, None, "EDU_CLASS_10", True),
    ("class_11_12", {"stream": "pcm"}, None, "EDU_12_PCM", True),
    ("class_11_12", {"stream": "pcb"}, None, "EDU_12_PCB", True),
    ("class_11_12", {"stream": "commerce"}, None, "EDU_12_COMMERCE", True),
    ("class_11_12", {"stream": "pcmb"}, None, "EDU_12_PCM", False),
    ("class_11_12", {"stream": "undecided"}, None, None, False),
    ("ug_student", {"degree": "B.Tech", "branch": "Computer Science"}, None, "EDU_BTECH_CSE", True),
    ("ug_student", {"degree": "B.E.", "branch": "CSE"}, None, "EDU_BTECH_CSE", True),
    ("ug_student", {"degree": "BTech", "branch": "Information Technology"}, None, "EDU_BTECH_CSE", True),
    ("ug_student", {"degree": "B.Tech", "branch": "ECE"}, None, "EDU_BTECH_ECE", True),
    ("ug_student", {"degree": "B.Tech", "branch": "Mechanical"}, None, "EDU_BTECH_MECH", True),
    ("ug_student", {"degree": "B.Tech", "branch": "Civil"}, None, "EDU_BTECH_MECH", False),
    ("ug_student", {"degree": "BCA"}, None, "EDU_BCA", True),
    ("bachelors_graduate", {"degree": "B.Com"}, None, "EDU_BCOM", True),
    ("ug_student", {"degree": "B.Sc", "branch": "Statistics"}, None, "EDU_BSC_MATH_STATS", True),
    ("ug_student", {"degree": "B.Sc", "branch": "Computer Science"}, None, "EDU_BSC_CS", True),
    ("ug_student", {"degree": "BA", "branch": "History"}, None, "EDU_BA", True),
    ("ug_student", {}, None, None, False),
    ("masters_student", {"degree": "MBA"}, None, "EDU_MBA", True),
    ("masters_student", {"degree": "MCA"}, None, "EDU_MCA", True),
    ("masters_student", {"degree": "M.Tech", "branch": "CSE"}, None, "EDU_MTECH_CSE", True),
    ("masters_student", {"degree": "M.Sc", "branch": "Data Science"}, None, "EDU_MSC_DS", True),
    ("masters_student", {"degree": "MS", "branch": "Computer Science"}, None, "EDU_MS_CS_ABROAD", True),
    ("phd_student", {"branch": "Computer Science"}, None, "EDU_PHD_CS", True),
    ("working_professional", {}, "Senior Software Engineer", "EDU_WORKING_TECH", True),
    ("career_changer", {}, "School teacher", "EDU_WORKING_NONTECH", True),
    ("diploma", {"branch": "Computer Engineering"}, None, "EDU_DIPLOMA_CS", True),
])
def test_guess_stage(stage, education, role, expected, exact):
    guess = guess_stage(stage, education, role)
    assert guess.stage_id == expected
    assert guess.exact is exact
    assert guess.note  # always explains itself


def test_skill_and_career_matching(catalog):
    assert match_skill(catalog, "Python") == "SKL_PYTHON"
    assert match_skill(catalog, "  python3 ") == "SKL_PYTHON"  # alias, extra spaces
    assert match_skill(catalog, "k8s") == "SKL_KUBERNETES"
    assert match_skill(catalog, "Underwater basket weaving") is None
    assert match_career(catalog, "Senior Data Scientist") == "CAR_DATA_SCIENTIST"
    assert match_career(catalog, "Backend Developer II") == "CAR_BACKEND_DEVELOPER"
    assert match_career(catalog, "Chef de partie") == "CAR_CHEF"
    assert match_career(catalog, "Astronaut") is None


# ---------------------------------------------------------------- engine
def test_every_stage_gives_valid_options(catalog):
    for stage_id in catalog.stages:
        result = next_steps(catalog, stage_id, UserContext())
        options = [o for group in result["groups"].values() for o in group]
        assert result["counts"]["options"] == len(options)
        for o in options:
            assert o["title"] and o["eligibility"] and o["next_action"]
            assert o["kind"] in {"education", "career", "exam"}  # courses are education steps too
            for exam in o["exams"]:
                assert exam["official_url"].startswith("https://")
    with pytest.raises(UnknownStage):
        next_steps(catalog, "EDU_NOPE", UserContext())


def test_btech_cse_options_are_complete(catalog):
    result = next_steps(catalog, "EDU_BTECH_CSE", UserContext())
    groups = result["groups"]
    assert {"M.Tech – Computer Science", "MBA"} <= {o["title"] for o in groups["education"]}
    mtech = next(o for o in groups["education"] if o["target_id"] == "EDU_MTECH_CSE")
    assert [e["name"] for e in mtech["exams"]] == ["GATE"]
    assert mtech["duration_years"] == 2
    assert "GATE" in mtech["next_action"]
    assert any(c["id"] == "CAR_AI_RESEARCH_SCIENTIST" for c in mtech["opens"]["careers"])
    assert "Software Engineer" in {o["title"] for o in groups["career"]}
    assert {s["career_id"] for s in result["switches"]} == {
        "CAR_DATA_SCIENTIST", "CAR_GRAPHIC_DESIGNER", "CAR_CONTENT_CREATOR", "CAR_MUSIC_PRODUCER",
        "CAR_STANDUP_COMEDIAN"}
    assert result["personalised"] is False


COURSE_STAGES = {"EDU_COURSE_MUSIC", "EDU_COURSE_DANCE", "EDU_COURSE_DESIGN", "EDU_COURSE_WRITING",
                 "EDU_COURSE_PERFORMING", "EDU_COURSE_MEDIA", "EDU_COURSE_VOCATIONAL"}


def test_professional_courses_are_their_own_group(catalog):
    """A B.Tech student also sees music, dance, design, writing, acting/comedy, film and vocational courses."""
    groups = next_steps(catalog, "EDU_BTECH_CSE", UserContext())["groups"]
    assert {o["target_id"] for o in groups["course"]} == COURSE_STAGES
    assert not COURSE_STAGES & {o["target_id"] for o in groups["education"]}  # not mixed with M.Tech / MBA
    music = next(o for o in groups["course"] if o["target_id"] == "EDU_COURSE_MUSIC")
    assert {c["id"] for c in music["opens"]["careers"]} == {"CAR_SINGER", "CAR_MUSIC_PRODUCER", "CAR_SOUND_ENGINEER"}
    performing = next(o for o in groups["course"] if o["target_id"] == "EDU_COURSE_PERFORMING")
    assert "CAR_STANDUP_COMEDIAN" in {c["id"] for c in performing["opens"]["careers"]}


def test_courses_open_from_school_and_work_too(catalog):
    for stage_id in ("EDU_CLASS_10", "EDU_12_HUMANITIES", "EDU_BA", "EDU_WORKING_NONTECH"):
        groups = next_steps(catalog, stage_id, UserContext())["groups"]
        assert {o["target_id"] for o in groups["course"]} == COURSE_STAGES, stage_id
    # a course leads straight to its careers, and needs no degree
    careers = next_steps(catalog, "EDU_COURSE_WRITING", UserContext())["groups"]["career"]
    assert {o["target_id"] for o in careers} == {"CAR_POET_LYRICIST", "CAR_CONTENT_WRITER"}
    assert all("No degree needed" in o["eligibility"] for o in careers)


def test_creative_interest_ranks_matching_course_first(catalog):
    ctx = UserContext(has_profile=True, interests=["dance"])
    courses = next_steps(catalog, "EDU_BTECH_CSE", ctx)["groups"]["course"]
    assert courses[0]["target_id"] == "EDU_COURSE_DANCE"
    assert "it leads to careers matching your interests" in courses[0]["reasons"]


def test_goals_and_skills_change_the_order(catalog):
    base = UserContext(has_profile=True)
    plain = next_steps(catalog, "EDU_BTECH_CSE", base)["groups"]["education"]

    studies = UserContext(has_profile=True, goals=["higher_studies", "study_abroad"])
    ranked = next_steps(catalog, "EDU_BTECH_CSE", studies)["groups"]["education"]
    assert ranked[0]["target_id"] == "EDU_MS_CS_ABROAD"
    assert "you want to study abroad" in ranked[0]["reasons"]
    assert [o["target_id"] for o in plain] != [o["target_id"] for o in ranked]

    # A user with data skills sees data careers first, with the reason
    data = UserContext(has_profile=True, goals=["job"], skills={
        "SKL_PYTHON": 3, "SKL_SQL": 3, "SKL_STATISTICS": 3, "SKL_ML": 2, "SKL_PANDAS": 3, "SKL_PROBABILITY": 2})
    careers = next_steps(catalog, "EDU_BTECH_CSE", data)["groups"]["career"]
    assert careers[0]["target_id"] == "CAR_DATA_SCIENTIST"
    assert any("skills" in r for r in careers[0]["reasons"])
    assert "Python" in careers[0]["skills"]["have"]


def test_government_goal_puts_government_first(catalog):
    ctx = UserContext(has_profile=True, goals=["government_career"])
    careers = next_steps(catalog, "EDU_BTECH_CSE", ctx)["groups"]["career"]
    assert careers[0]["domain"] == "Government"


# ---------------------------------------------------------------- API
def test_api_for_visitors(api):
    body = api.get("/api/next-steps?stage=EDU_12_PCM").json()
    assert body["context"]["logged_in"] is False and body["context"]["source"] == "query"
    titles = {o["title"] for o in body["result"]["groups"]["education"]}
    assert "B.Tech – Computer Science" in titles

    # No stage and not logged in: asks the user to pick one
    body = api.get("/api/next-steps").json()
    assert body["result"] is None and body["context"]["source"] == "none"


def test_api_uses_the_profile(api, make_user):
    client = make_user()
    client.put("/api/profile", json=valid_profile())
    body = client.get("/api/next-steps").json()
    assert body["context"]["source"] == "profile"
    assert body["context"]["profile_stage_id"] == "EDU_BTECH_CSE"
    assert body["result"]["stage"]["stage_id"] == "EDU_BTECH_CSE"
    assert body["result"]["personalised"] is True
    # The profile goal "higher_studies" moves further study up and explains why
    first = body["result"]["groups"]["education"][0]
    assert "you want higher studies" in first["reasons"]
    # Another stage can still be explored while logged in
    other = client.get("/api/next-steps?stage=EDU_BCA").json()
    assert other["result"]["stage"]["stage_id"] == "EDU_BCA" and other["context"]["source"] == "query"


def test_api_errors(api, client):
    assert api.get("/api/next-steps?stage=EDU_UNKNOWN").status_code == 404
    assert api.get("/api/next-steps?stage=" + "x" * 41).status_code == 422


def test_api_without_reference_data(client):
    response = client.get("/api/next-steps?stage=EDU_BTECH_CSE")
    assert response.status_code == 503
    assert "seed" in response.json()["detail"]
