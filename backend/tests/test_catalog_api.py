"""Catalog API: search, filters, detail pages and bad input."""
import pytest

from catalog.seed import seed
from database import SessionLocal


@pytest.fixture
def api(client):
    with SessionLocal() as db:
        seed(db, force=True)
    return client


def test_stages_sorted_by_level(api):
    stages = api.get("/api/catalog/stages").json()
    assert len(stages) == 37
    assert stages[0]["level"] == "school"
    assert stages[-1]["level"] == "professional"
    ug = api.get("/api/catalog/stages?level=ug").json()
    assert ug and all(s["level"] == "ug" for s in ug)


def test_skill_search_uses_names_and_aliases(api):
    names = [s["name"] for s in api.get("/api/catalog/skills?q=python").json()]
    assert names[0] == "Python"  # exact match first
    assert "Apache Kafka" not in names
    # "k8s" is only an alias
    assert [s["name"] for s in api.get("/api/catalog/skills?q=k8s").json()] == ["Kubernetes"]
    # Name matches rank above alias-only matches
    py = [s["name"] for s in api.get("/api/catalog/skills?q=py").json()]
    assert py.index("Python") < py.index("Apache Spark")


def test_skill_category_filter_and_limit(api):
    soft = api.get("/api/catalog/skills?category=soft").json()
    assert soft and all(s["category"] == "soft" for s in soft)
    assert len(api.get("/api/catalog/skills?limit=5").json()) == 5


def test_career_list_search_filter_and_paging(api):
    all_careers = api.get("/api/catalog/careers").json()
    assert all_careers["total"] == 79
    assert {"Technology", "Creative Arts", "Vocational"} <= set(all_careers["domains"])
    creative = api.get("/api/catalog/careers?domain=Creative+Arts&limit=50").json()
    assert creative["total"] == 18
    assert {"Singer", "Dancer", "Poet and Lyricist", "Stand-up Comedian", "Graphic Designer"} <= {
        c["name"] for c in creative["items"]}
    assert all(c["min_education_level"] == "school" for c in creative["items"])  # no degree needed
    assert "Technology" in all_careers["domains"]

    data = api.get("/api/catalog/careers?q=DATA").json()  # case-insensitive
    assert {"Data Analyst", "Data Scientist", "Data Engineer"} <= {c["name"] for c in data["items"]}

    gov = api.get("/api/catalog/careers?domain=Government").json()
    assert gov["total"] == 3 and all(c["domain"] == "Government" for c in gov["items"])

    commerce = api.get("/api/catalog/careers?stage=EDU_BCOM").json()
    assert "Accountant" in {c["name"] for c in commerce["items"]}

    page = api.get("/api/catalog/careers?limit=10&offset=70").json()
    assert page["total"] == 79 and len(page["items"]) == 9


def test_no_results_is_empty_not_error(api):
    body = api.get("/api/catalog/careers?q=astronaut").json()
    assert body["total"] == 0 and body["items"] == []


def test_career_detail_has_everything(api):
    d = api.get("/api/catalog/careers/CAR_DATA_SCIENTIST").json()
    assert d["name"] == "Data Scientist"
    assert d["skills"][0]["is_mandatory"] is True
    assert d["skills"][0]["importance"] == 5
    assert {"Python", "Statistics", "Machine learning"} <= {s["name"] for s in d["skills"]}
    assert any(p["from_stage_id"] == "EDU_BTECH_CSE" for p in d["entry_paths"])
    assert any(c["name"] == "Machine Learning Engineer" for c in d["next_careers"])
    assert any(c["name"] == "Data Analyst" for c in d["previous_careers"])
    switch = next(t for t in d["transitions_in"] if t["from_id"] == "EDU_BTECH_CSE")
    assert switch["from_name"] == "B.Tech – Computer Science"
    assert switch["steps"][0] == "Learn Python data stack"
    assert "Statistics" in switch["required_skills"]  # names, not IDs
    assert d["source_url"].startswith("https://")


def test_entry_path_lists_required_exams_with_links(api):
    d = api.get("/api/catalog/careers/CAR_PSU_ENGINEER").json()
    exams = [e for p in d["entry_paths"] for e in p["required_exams"]]
    assert exams and exams[0]["name"] == "GATE"
    assert exams[0]["official_url"].startswith("https://")
    assert exams[0]["verified"] is True  # GATE 2027 eligibility checked on the official site


def test_every_career_detail_loads(api):
    for career in api.get("/api/catalog/careers?limit=100").json()["items"]:
        response = api.get(f"/api/catalog/careers/{career['career_id']}")
        assert response.status_code == 200, career["career_id"]
        assert response.json()["skills"], career["career_id"]


def test_exams_filters_and_detail(api):
    assert len(api.get("/api/catalog/exams").json()) == 26
    pg = api.get("/api/catalog/exams?level=pg_admission").json()
    assert "GATE" in {e["name"] for e in pg}
    for_12 = {e["name"] for e in api.get("/api/catalog/exams?stage=EDU_12_PCM").json()}
    assert {"JEE Main", "JEE Advanced"} <= for_12 and "GATE" not in for_12
    assert api.get("/api/catalog/exams?q=management").json()[0]["name"] == "CAT"
    assert api.get("/api/catalog/exams/EXM_GATE").json()["conducting_body"].startswith("IISc")


@pytest.mark.parametrize(
    "url,code",
    [
        ("/api/catalog/careers/CAR_NOPE", 404),
        ("/api/catalog/exams/EXM_NOPE", 404),
        ("/api/catalog/careers?limit=0", 422),
        ("/api/catalog/careers?limit=1000", 422),
        ("/api/catalog/careers?offset=-1", 422),
        ("/api/catalog/skills?q=" + "x" * 61, 422),
    ],
)
def test_bad_requests_get_clear_errors(api, url, code):
    response = api.get(url)
    assert response.status_code == code
    assert isinstance(response.json()["detail"], str)


def test_empty_catalog_returns_empty_lists(client):
    # Before any data is loaded the API must still work
    assert client.get("/api/catalog/careers").json() == {"total": 0, "items": [], "domains": []}
    assert client.get("/api/catalog/skills").json() == []
