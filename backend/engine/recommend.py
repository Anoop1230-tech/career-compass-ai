"""Recommendation Engine: weighted, explainable career scores.

Every career gets a 0-100 score from up to six signals. Each signal is
0-100 and has a fixed weight. When a signal is missing (e.g. the aptitude
test was not taken) its weight is shared among the available signals, and
the result's `confidence` says how much evidence was used.

Signals and weights (sum 100):
  interest     22  RIASEC test vs the career's Holland codes
  skills       22  importance-weighted share of the career's skills you have
  education    18  can your current stage reach this career, and how directly
  aptitude     14  aptitude quiz scores in the career's key aptitude areas
  personality  10  work-style traits the career needs (test, else self-ratings)
  preferences  14  profile interests, goals and preferred work mode

Rules are deliberately simple so every number can be explained to the user.
Phase 13 compares this against ML models and keeps whichever is better."""
from collections import deque

from catalog.models import Career
from engine.catalog_data import LEVEL_ORDER, Catalog
from engine.context import UserContext
from engine.fit import GOAL_LABELS, goal_matches_career, interest_matches, skill_coverage

WEIGHTS = {"interest": 22, "skills": 22, "education": 18, "aptitude": 14, "personality": 10, "preferences": 14}
LABELS = {
    "interest": "Interest test", "skills": "Your skills", "education": "Education path",
    "aptitude": "Aptitude quiz", "personality": "Work style", "preferences": "Interests and goals",
}
# The part of the evidence that comes from tests and skills, not just preferences
EVIDENCE = {"interest", "skills", "aptitude", "personality"}

RIASEC_NAMES = {"R": "Realistic", "I": "Investigative", "A": "Artistic", "S": "Social", "E": "Enterprising",
                "C": "Conventional"}
FIT_TRAITS = {"team": "team_orientation", "creative": "creativity", "research": "research_orientation",
              "leadership": "leadership", "risk_tolerant": "risk_tolerance"}
FIT_LABELS = {"team": "teamwork", "creative": "creativity", "research": "research", "leadership": "leadership",
              "risk_tolerant": "comfort with risk"}
APTITUDE_LABELS = {"numerical": "numerical", "logical": "logical", "verbal": "verbal", "spatial": "spatial",
                   "problem_solving": "problem-solving"}
WORK_MODE_STYLES = {"remote": {"remote_friendly"}, "hybrid": {"remote_friendly", "office"}, "office": {"office", "campus"},
                    "field": {"field"}}


# ---------------------------------------------------------------- reachability
def reachable_careers(catalog: Catalog, stage_id: str | None, max_hops: int = 3) -> dict[str, int]:
    """career_id -> number of education steps needed from the stage (1 = direct).
    Follows education -> education edges (e.g. BCA -> MCA -> career)."""
    if not stage_id or stage_id not in catalog.stages:
        return {}
    result: dict[str, int] = {}
    queue = deque([(stage_id, 0)])
    seen = {stage_id}
    while queue:
        current, hops = queue.popleft()
        if hops >= max_hops:
            continue
        for path in catalog.paths_from(current):
            if path.to_type == "career":
                result.setdefault(path.to_id, hops + 1)
            elif path.to_type == "education" and path.to_id not in seen:
                seen.add(path.to_id)
                queue.append((path.to_id, hops + 1))
    return result


def _level_index(level: str | None) -> int:
    return LEVEL_ORDER.index(level) if level in LEVEL_ORDER else -1


# ---------------------------------------------------------------- signals
def _interest(ctx: UserContext, career: Career):
    if not ctx.riasec or not career.riasec_codes:
        return None
    weights = [3, 2, 1][: len(career.riasec_codes)]
    score = sum(ctx.riasec.get(code, 0) * w for code, w in zip(career.riasec_codes, weights)) / sum(weights)
    top = sorted(ctx.riasec, key=lambda k: -ctx.riasec[k])[:3]
    shared = [RIASEC_NAMES[c] for c in career.riasec_codes if c in top]
    if shared:
        why = f"Your interest test is strong in {', '.join(shared)}, which this career needs"
    else:
        why = f"This career suits {', '.join(RIASEC_NAMES[c] for c in career.riasec_codes)} interests, which are not your top types"
    return score, why


def _skills(catalog: Catalog, ctx: UserContext, career: Career):
    coverage = skill_coverage(catalog, ctx, career.career_id)
    if not ctx.skills:
        return None, coverage
    have = [catalog.skill_name(l.skill_id) for l in coverage["have"]][:4]
    if have and coverage["score"] < 40:
        why = f"You have {', '.join(have)}, but most of its skills are still to learn"
    elif have:
        why = f"You already have {', '.join(have)}"
    else:
        why = "None of your listed skills are core to this career yet"
    return (coverage["score"], why), coverage


def _education(catalog: Catalog, ctx: UserContext, career: Career, reach: dict[str, int]):
    stage_id = ctx.stage.stage_id
    if not stage_id:
        return None
    stage = catalog.stages.get(stage_id)
    if stage_id in career.typical_stage_ids or reach.get(career.career_id) == 1:
        return 100.0, f"Your current stage ({stage.name}) leads directly to this career"
    if career.career_id in reach:
        steps = reach[career.career_id]
        return (75.0 if steps == 2 else 55.0), f"Reachable from {stage.name} with {steps - 1} more study step(s)"
    # Working professionals and anyone already past the minimum level can often switch with skills
    if any(t.to_career_id == career.career_id and t.from_id in {stage_id, ctx.current_career_id}
           for t in catalog.transitions):
        return 65.0, "A known switch path exists from where you are"
    if _level_index(stage.level) >= _level_index(career.min_education_level) >= 0:
        return 45.0, "Your education level is enough, but it is not a usual route"
    return 20.0, "Usually needs a different degree or more study than you have now"


def _aptitude(ctx: UserContext, career: Career):
    if not ctx.aptitude or not career.key_aptitudes:
        return None
    values = [(a, ctx.aptitude[a]) for a in career.key_aptitudes if a in ctx.aptitude]
    if not values:
        return None
    score = sum(v for _, v in values) / len(values)
    best = max(values, key=lambda x: x[1])
    return score, f"Aptitude quiz: {APTITUDE_LABELS.get(best[0], best[0])} {best[1]:.0f}/100 in an area this career uses"


def _personality(ctx: UserContext, career: Career):
    if not career.personality_fit:
        return None
    traits = [(f, FIT_TRAITS[f]) for f in career.personality_fit if f in FIT_TRAITS]
    if ctx.personality:
        values = [(f, ctx.personality[t]) for f, t in traits if t in ctx.personality]
        source = "work-style test"
    else:
        values = [(f, (ctx.self_ratings[t] - 1) * 25.0) for f, t in traits if t in ctx.self_ratings]
        source = "self-ratings"
    if not values:
        return None
    score = sum(v for _, v in values) / len(values)
    names = ", ".join(FIT_LABELS[f] for f, _ in values)
    return score, f"Needs {names}; your {source} give {score:.0f}/100"


def _preferences(ctx: UserContext, career: Career):
    if not (ctx.interests or ctx.goals or ctx.work_mode != "any"):
        return None
    score, parts = 40.0, []
    interests = interest_matches(ctx, career)
    if interests:
        score += 35
        parts.append("matches your interest in " + ", ".join(i.replace("_", " ") for i in interests))
    goals = goal_matches_career(ctx, career)
    if goals:
        score += min(25, 15 * len(goals))
        parts.append("; ".join(GOAL_LABELS[g] for g in goals))
    styles = WORK_MODE_STYLES.get(ctx.work_mode)
    if styles:
        if styles & set(career.work_style):
            score += 10
        else:
            score -= 15
            parts.append(f"usual work setting may not match your {ctx.work_mode} preference")
    score = max(0.0, min(100.0, score))
    return score, ("It " + "; ".join(parts)) if parts else "No strong link to your stated interests or goals"


# ---------------------------------------------------------------- scoring
def score_career(catalog: Catalog, ctx: UserContext, career: Career, reach: dict[str, int]) -> dict:
    skills_signal, coverage = _skills(catalog, ctx, career)
    raw = {
        "interest": _interest(ctx, career),
        "skills": skills_signal,
        "education": _education(catalog, ctx, career, reach),
        "aptitude": _aptitude(ctx, career),
        "personality": _personality(ctx, career),
        "preferences": _preferences(ctx, career),
    }
    available = {k: v for k, v in raw.items() if v is not None}
    total_weight = sum(WEIGHTS[k] for k in available)
    score = sum(v[0] * WEIGHTS[k] for k, v in available.items()) / total_weight if total_weight else 0.0

    components = []
    for key in WEIGHTS:
        value = raw[key]
        components.append({
            "key": key,
            "label": LABELS[key],
            "weight": WEIGHTS[key],
            "available": value is not None,
            "score": round(value[0], 1) if value else None,
            "explanation": value[1] if value else None,
            # Points this signal actually added to the final score
            "contribution": round(value[0] * WEIGHTS[key] / total_weight, 1) if value and total_weight else 0.0,
        })
    strengths = [c["explanation"] for c in sorted(components, key=lambda c: -(c["score"] or 0))
                 if c["available"] and c["score"] >= 60][:3]
    concerns = [c["explanation"] for c in sorted(components, key=lambda c: c["score"] or 0)
                if c["available"] and c["score"] < 40][:2]
    return {
        "career_id": career.career_id,
        "name": career.name,
        "domain": career.domain,
        "sub_domain": career.sub_domain,
        "description": career.description,
        "score": round(score, 1),
        "components": components,
        "strengths": strengths,
        "concerns": concerns,
        "skills_to_learn": [catalog.skill_name(l.skill_id) for l in coverage["mandatory_missing"]][:5],
        "steps_from_stage": reach.get(career.career_id),
    }


def confidence(ctx: UserContext) -> dict:
    have = {
        "interest": ctx.riasec is not None, "skills": bool(ctx.skills), "education": bool(ctx.stage.stage_id),
        "aptitude": ctx.aptitude is not None,
        "personality": ctx.personality is not None or bool(ctx.self_ratings),
        "preferences": bool(ctx.interests or ctx.goals),
    }
    pct = sum(WEIGHTS[k] for k, ok in have.items() if ok)
    level = "high" if pct >= 85 else "medium" if pct >= 55 else "low"
    tips = []
    if ctx.riasec is None:
        tips.append({"key": "interest", "text": "Take the interest test", "link": "/assessments/interest"})
    if not ctx.skills:
        tips.append({"key": "skills", "text": "Add your skills to your profile", "link": "/profile/edit"})
    if not ctx.stage.stage_id:
        tips.append({"key": "education", "text": "Add your education details", "link": "/profile/edit"})
    return {"percent": pct, "level": level, "signals": have, "improve": tips}


def recommend(catalog: Catalog, ctx: UserContext, domain: str | None = None, limit: int = 10) -> dict:
    reach = reachable_careers(catalog, ctx.stage.stage_id)
    careers = [c for c in catalog.careers.values() if domain is None or c.domain == domain]
    scored = [score_career(catalog, ctx, c, reach) for c in careers]
    scored.sort(key=lambda r: (-r["score"], r["name"]))
    conf = confidence(ctx)
    if conf["percent"] == 0:
        scored = []  # nothing to go on: better no list than a meaningless one
    return {
        "confidence": conf,
        "weights": WEIGHTS,
        "domains": sorted({c.domain for c in catalog.careers.values()}),
        "total": len(scored),
        "items": scored[:limit],
    }
