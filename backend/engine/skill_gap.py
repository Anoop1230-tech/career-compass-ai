"""Skill Gap Analysis: your skills vs a target career's skills, prioritised.

priority = importance (1-5) x 1.5 if the skill is core x levels still missing
Learning time is a ROUGH planning estimate at about 8 hours per week:
  none -> beginner 3 weeks, beginner -> intermediate 5 weeks, intermediate -> advanced 8 weeks.
Real time varies a lot by person and by skill; the UI says so."""
from engine.catalog_data import Catalog
from engine.context import UserContext
from engine.fit import PROFICIENCY_VALUE, skill_coverage

LEVEL_NAMES = {0: "none", 1: "beginner", 2: "intermediate", 3: "advanced"}
WEEKS_PER_STEP = {1: 3, 2: 5, 3: 8}  # weeks to reach this level from the one below
HOURS_PER_WEEK = 8
# Foundations first when priorities tie
CATEGORY_ORDER = ["math", "programming", "technical", "domain", "management", "soft"]


class UnknownCareer(LookupError):
    pass


def weeks_between(current: int, required: int) -> int:
    return sum(WEEKS_PER_STEP[level] for level in range(current + 1, required + 1))


def skill_gap(catalog: Catalog, ctx: UserContext, career_id: str) -> dict:
    career = catalog.careers.get(career_id)
    if career is None:
        raise UnknownCareer(career_id)

    items = []
    for link in catalog.career_skills.get(career_id, []):
        skill = catalog.skills.get(link.skill_id)
        need = PROFICIENCY_VALUE.get(link.proficiency_required, 2)
        have = ctx.skills.get(link.skill_id, 0)
        gap = max(0, need - have)
        status = "have" if gap == 0 else "partial" if have else "missing"
        items.append({
            "skill_id": link.skill_id,
            "name": skill.name if skill else link.skill_id,
            "category": skill.category if skill else "other",
            "description": skill.description if skill else None,
            "importance": link.importance,
            "is_mandatory": link.is_mandatory,
            "required_level": LEVEL_NAMES[need],
            "current_level": LEVEL_NAMES[have],
            "source": ctx.skill_sources.get(link.skill_id),
            "status": status,
            "priority": round(link.importance * (1.5 if link.is_mandatory else 1) * gap, 1),
            "weeks": weeks_between(have, need),
        })

    def order(i):
        cat = CATEGORY_ORDER.index(i["category"]) if i["category"] in CATEGORY_ORDER else len(CATEGORY_ORDER)
        return (-i["priority"], cat, i["name"])

    # Core skills always come first; within each group, highest priority first
    gaps = sorted([i for i in items if i["status"] != "have"], key=lambda i: (not i["is_mandatory"], *order(i)))
    for rank, item in enumerate(gaps, 1):
        item["rank"] = rank
    have = sorted([i for i in items if i["status"] == "have"], key=lambda i: (-i["importance"], i["name"]))
    core = [i for i in items if i["is_mandatory"]]
    career_skill_ids = {i["skill_id"] for i in items}
    transferable = sorted(catalog.skill_name(s) for s in ctx.skills if s not in career_skill_ids)
    core_weeks = sum(i["weeks"] for i in gaps if i["is_mandatory"])

    return {
        "career": {"career_id": career.career_id, "name": career.name, "domain": career.domain},
        "readiness": skill_coverage(catalog, ctx, career_id)["score"],
        "core_ready": sum(1 for i in core if i["status"] == "have"),
        "core_total": len(core),
        "learn_first": [i for i in gaps if i["is_mandatory"]],
        "learn_next": [i for i in gaps if not i["is_mandatory"]],
        "have": have,
        "transferable": transferable,
        "estimate": {
            "core_weeks": core_weeks,
            "all_weeks": sum(i["weeks"] for i in gaps),
            "hours_per_week": HOURS_PER_WEEK,
        },
        "has_skills": bool(ctx.skills),
        "unmatched_skills": ctx.unmatched_skills,
    }
