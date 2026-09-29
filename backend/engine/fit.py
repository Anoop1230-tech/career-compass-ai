"""Small shared rules that turn profile answers into signals about careers.

Kept in one place so the Next Step Engine, the recommendations and the
mentor explain things the same way."""
from catalog.models import Career
from engine.catalog_data import Catalog
from engine.context import UserContext

PROFICIENCY_VALUE = {"beginner": 1, "intermediate": 2, "advanced": 3}

# Profile interest -> career domains / sub-domains it points to
INTEREST_DOMAINS: dict[str, set[str]] = {
    "technology": {"Technology"},
    "engineering": {"Technology", "Government"},
    "business": {"Business"},
    "finance": {"Finance"},
    "government": {"Government"},
    "education": {"Education"},
    "research": {"AI/ML", "Higher Education", "Data"},
    "science": {"AI/ML", "Data", "Higher Education"},
    "design": {"Design"},
    "arts": {"Design", "Creative Arts"},
    "media": {"Design", "Product", "Film and Media", "Writing", "Performing Arts"},
    "social_work": {"Education", "Administration"},
    "defence": {"Government"},
    "music": {"Music"},
    "dance": {"Dance"},
    "writing": {"Writing"},
    "performing_arts": {"Performing Arts"},
    "film": {"Film and Media"},
    "fashion": {"Design", "Beauty"},
    "cooking": {"Culinary"},
    "hospitality": {"Culinary"},
    "fitness": {"Fitness"},
    "sports": {"Fitness"},
}

# Profile goal -> which kind of next step or career it favours
GOAL_LABELS = {
    "job": "you want a job",
    "higher_studies": "you want higher studies",
    "government_career": "you want a government career",
    "research": "you are interested in research",
    "entrepreneurship": "you want to start a business",
    "study_abroad": "you want to study abroad",
    "leadership": "you want a leadership role",
    "remote_work": "you prefer remote work",
    "higher_salary": "you want a higher salary",
    "career_switch": "you want to switch career",
    "work_life_balance": "you want work-life balance",
}

RESEARCH_CAREERS = {"CAR_AI_RESEARCH_SCIENTIST", "CAR_ASSISTANT_PROFESSOR", "CAR_DATA_SCIENTIST"}
LEADERSHIP_CAREERS = {"CAR_ENGINEERING_MANAGER", "CAR_PRODUCT_MANAGER", "CAR_SOLUTIONS_ARCHITECT",
                      "CAR_TECH_ENTREPRENEUR", "CAR_CIVIL_SERVICES"}


def career_tags(career: Career) -> set[str]:
    return {career.domain, career.sub_domain or ""}


def interest_matches(ctx: UserContext, career: Career) -> list[str]:
    """Profile interests (labels) that point at this career."""
    tags = career_tags(career)
    return [i for i in ctx.interests if INTEREST_DOMAINS.get(i, set()) & tags]


def goal_matches_career(ctx: UserContext, career: Career) -> list[str]:
    goals = set(ctx.goals)
    hits = []
    if "government_career" in goals and career.domain == "Government":
        hits.append("government_career")
    if "research" in goals and career.career_id in RESEARCH_CAREERS:
        hits.append("research")
    if "entrepreneurship" in goals and career.career_id == "CAR_TECH_ENTREPRENEUR":
        hits.append("entrepreneurship")
    if "leadership" in goals and career.career_id in LEADERSHIP_CAREERS:
        hits.append("leadership")
    if "remote_work" in goals and "remote_friendly" in career.work_style:
        hits.append("remote_work")
    return hits


def skill_coverage(catalog: Catalog, ctx: UserContext, career_id: str) -> dict:
    """How much of a career's skill list the user already has.

    Score = importance-weighted share of skills, where a skill below the
    required level counts partially (e.g. beginner vs intermediate = 1/2)."""
    links = catalog.career_skills.get(career_id, [])
    total = sum(l.importance for l in links) or 1
    earned = 0.0
    have, partial, missing = [], [], []
    for link in links:
        need = PROFICIENCY_VALUE.get(link.proficiency_required, 2)
        level = ctx.skills.get(link.skill_id, 0)
        if level >= need:
            earned += link.importance
            have.append(link)
        elif level > 0:
            earned += link.importance * level / need
            partial.append(link)
        else:
            missing.append(link)
    return {
        "score": round(earned / total * 100, 1) if links else 0.0,
        "have": have,
        "partial": partial,
        "missing": missing,
        "mandatory_missing": [l for l in missing if l.is_mandatory],
    }
