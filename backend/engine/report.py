"""One-page career report for printing or saving as PDF from the browser.

Pulls together what the other engines already compute; nothing new is estimated here."""
from datetime import date

from engine.catalog_data import Catalog
from engine.context import UserContext
from engine.next_steps import next_steps
from engine.recommend import confidence, recommend
from engine.roadmap import build_roadmap

TOP_MATCHES = 5
TOP_STEPS = 3
RIASEC = ["R", "I", "A", "S", "E", "C"]


def _tests(ctx: UserContext) -> dict:
    out = {}
    if ctx.riasec:
        top = sorted(RIASEC, key=lambda k: -ctx.riasec.get(k, 0))[:3]
        out["interest"] = {"top_codes": top, "scores": {k: round(ctx.riasec.get(k, 0)) for k in RIASEC}}
    if ctx.aptitude:
        out["aptitude"] = {k: round(v) for k, v in sorted(ctx.aptitude.items(), key=lambda kv: -kv[1])}
    if ctx.personality:
        out["personality"] = {k: round(v) for k, v in sorted(ctx.personality.items(), key=lambda kv: -kv[1])}
    return out


def _next_steps(catalog: Catalog, ctx: UserContext) -> list[dict]:
    if not ctx.stage.stage_id:
        return []
    groups = next_steps(catalog, ctx.stage.stage_id, ctx)["groups"]
    options = [o for key in ("education", "career", "exam") for o in groups.get(key, [])]
    options.sort(key=lambda o: -(o.get("relevance") or 0))
    return [{"title": o["title"], "kind": o["kind"], "next_action": o.get("next_action"),
             "reasons": (o.get("reasons") or [])[:2]} for o in options[:TOP_STEPS]]


def _roadmap(catalog: Catalog, ctx: UserContext, career_id: str, done: set[str], done_steps: set[str]) -> dict:
    road = build_roadmap(catalog, ctx, career_id, done, done_steps)
    stages = []
    for s in road["stages"]:
        if s["key"] == "study":
            items = [i["title"] for i in s["items"]]
        elif s["key"] in ("foundations", "core", "specialise"):
            items = [i["name"] for i in s["items"] if not i["done"]][:6]
        elif s["key"] == "projects":
            items = [i["title"] for i in s["items"] if i["kind"] == "project"]
        else:
            items = [i["title"] for i in s["items"]]
        stages.append({"key": s["key"], "title": s["title"], "weeks": s["weeks"], "items": items})
    return {"career": road["career"], "stages": stages, "progress": road["progress"],
            "projects_progress": road.get("projects_progress"), "total_weeks": road["total_weeks"],
            "study_years": road["study_years"], "hours_per_week": road["hours_per_week"]}


def build_report(catalog: Catalog, ctx: UserContext, profile, target: dict | None) -> dict:
    """`target` is {"career_id", "done", "done_steps", "is_target"} or None (then the top match is used)."""
    matches = recommend(catalog, ctx, limit=TOP_MATCHES)["items"] if ctx.has_profile else []
    road = None
    if target:
        road = {**_roadmap(catalog, ctx, target["career_id"], target["done"], target["done_steps"]), "is_target": True}
    elif matches:
        road = {**_roadmap(catalog, ctx, matches[0]["career_id"], set(), set()), "is_target": False}
    education = profile.education or {} if profile else {}
    return {
        "generated_on": date.today().isoformat(),
        "profile": {
            "name": profile.full_name if profile else None,
            "stage": catalog.stage_name(ctx.stage.stage_id) if ctx.stage.stage_id else None,
            "education": " · ".join(str(v) for v in (education.get("degree") or education.get("stream"),
                                                      education.get("branch"), education.get("institution")) if v),
            "skills": [s.get("name") for s in (profile.skills or [])][:15] if profile else [],
            "interests": list(ctx.interests), "goals": list(ctx.goals),
        } if profile else None,
        "tests": _tests(ctx),
        "confidence": confidence(ctx) if ctx.has_profile else None,
        "matches": [{"career_id": m["career_id"], "name": m["name"], "domain": m["domain"], "score": m["score"],
                     "strengths": m["strengths"][:2], "concerns": m["concerns"][:1]} for m in matches],
        "next_steps": _next_steps(catalog, ctx),
        "roadmap": road,
    }
