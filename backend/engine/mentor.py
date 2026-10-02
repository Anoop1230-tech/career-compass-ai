"""Career Mentor: answers questions using the user's profile and the engines.

Works fully offline: questions are matched to an intent (next steps, dream
career check, skills, roadmap, exams, scholarships, colleges, compare,
salary, recommendations, career info) and answered from the same engines
the rest of the app uses. Every answer is grounded in the datasets and
carries links to the page with the full details. Nothing is invented: when
the data does not know (e.g. salaries), the mentor says so.

An optional language model (see services/llm.py) may rephrase the answer,
but only from the facts produced here."""
import re
from dataclasses import dataclass, field

from catalog.models import College, Scholarship
from engine.catalog_data import Catalog, normalize
from engine.context import UserContext
from engine.next_steps import next_steps
from engine.recommend import reachable_careers, recommend, score_career
from engine.roadmap import build_roadmap
from engine.skill_gap import skill_gap
from engine.transitions import LEVEL_WORDS, check_transition

# Extra ways people name careers and exams (all lower case)
CAREER_ALIASES = {
    "sde": "CAR_SOFTWARE_ENGINEER", "software developer": "CAR_SOFTWARE_ENGINEER", "programmer": "CAR_SOFTWARE_ENGINEER",
    "coder": "CAR_SOFTWARE_ENGINEER", "ml engineer": "CAR_ML_ENGINEER", "machine learning": "CAR_ML_ENGINEER",
    "ai engineer": "CAR_AI_ENGINEER", "ai researcher": "CAR_AI_RESEARCH_SCIENTIST", "researcher": "CAR_AI_RESEARCH_SCIENTIST",
    "data science": "CAR_DATA_SCIENTIST", "data analytics": "CAR_DATA_ANALYST", "ias": "CAR_CIVIL_SERVICES",
    "ips": "CAR_CIVIL_SERVICES", "civil services": "CAR_CIVIL_SERVICES", "upsc": "CAR_CIVIL_SERVICES",
    "ux designer": "CAR_UI_UX_DESIGNER", "ui designer": "CAR_UI_UX_DESIGNER", "designer": "CAR_UI_UX_DESIGNER",
    "ethical hacker": "CAR_PENETRATION_TESTER", "hacker": "CAR_PENETRATION_TESTER", "cyber security": "CAR_CYBERSECURITY_ANALYST",
    "cybersecurity": "CAR_CYBERSECURITY_ANALYST", "security analyst": "CAR_CYBERSECURITY_ANALYST", "pm": "CAR_PRODUCT_MANAGER",
    "product manager": "CAR_PRODUCT_MANAGER", "professor": "CAR_ASSISTANT_PROFESSOR", "lecturer": "CAR_ASSISTANT_PROFESSOR",
    "teacher": "CAR_SCHOOL_TEACHER", "principal": "CAR_SCHOOL_PRINCIPAL", "headmaster": "CAR_SCHOOL_PRINCIPAL",
    "special educator": "CAR_SPECIAL_EDUCATOR", "special education teacher": "CAR_SPECIAL_EDUCATOR",
    "counsellor": "CAR_SCHOOL_COUNSELLOR", "counselor": "CAR_SCHOOL_COUNSELLOR",
    "instructional designer": "CAR_INSTRUCTIONAL_DESIGNER", "e-learning designer": "CAR_INSTRUCTIONAL_DESIGNER",
    "bank po": "CAR_BANK_PO", "banker": "CAR_BANK_PO", "psu": "CAR_PSU_ENGINEER",
    "entrepreneur": "CAR_TECH_ENTREPRENEUR", "startup": "CAR_TECH_ENTREPRENEUR", "founder": "CAR_TECH_ENTREPRENEUR",
    "devops": "CAR_DEVOPS_ENGINEER", "cloud": "CAR_CLOUD_ENGINEER", "web developer": "CAR_FULLSTACK_DEVELOPER",
    "full stack": "CAR_FULLSTACK_DEVELOPER", "fullstack": "CAR_FULLSTACK_DEVELOPER", "android developer": "CAR_MOBILE_DEVELOPER",
    "app developer": "CAR_MOBILE_DEVELOPER", "game dev": "CAR_GAME_DEVELOPER", "tester": "CAR_QA_ENGINEER",
    "chip designer": "CAR_VLSI_ENGINEER", "vlsi": "CAR_VLSI_ENGINEER", "embedded": "CAR_EMBEDDED_ENGINEER",
    "ca": "CAR_ACCOUNTANT", "chartered accountant": "CAR_ACCOUNTANT", "consultant": "CAR_TECH_CONSULTANT",
    "singer": "CAR_SINGER", "singing": "CAR_SINGER", "vocalist": "CAR_SINGER", "musician": "CAR_SINGER",
    "music producer": "CAR_MUSIC_PRODUCER", "composer": "CAR_MUSIC_PRODUCER", "music director": "CAR_MUSIC_PRODUCER",
    "dancer": "CAR_DANCER", "dancing": "CAR_DANCER", "choreographer": "CAR_CHOREOGRAPHER",
    "graphic designer": "CAR_GRAPHIC_DESIGNER", "graphic design": "CAR_GRAPHIC_DESIGNER",
    "fashion designer": "CAR_FASHION_DESIGNER", "fashion designing": "CAR_FASHION_DESIGNER",
    "interior designer": "CAR_INTERIOR_DESIGNER", "animator": "CAR_ANIMATOR", "animation": "CAR_ANIMATOR", "vfx": "CAR_ANIMATOR",
    "poet": "CAR_POET_LYRICIST", "poetry": "CAR_POET_LYRICIST", "lyricist": "CAR_POET_LYRICIST", "shayar": "CAR_POET_LYRICIST",
    "writer": "CAR_CONTENT_WRITER", "content writer": "CAR_CONTENT_WRITER", "script writer": "CAR_CONTENT_WRITER",
    "actor": "CAR_ACTOR", "actress": "CAR_ACTOR", "acting": "CAR_ACTOR",
    "comedian": "CAR_STANDUP_COMEDIAN", "comedy": "CAR_STANDUP_COMEDIAN", "stand up": "CAR_STANDUP_COMEDIAN",
    "standup": "CAR_STANDUP_COMEDIAN", "anchor": "CAR_ANCHOR_RJ", "rj": "CAR_ANCHOR_RJ", "radio jockey": "CAR_ANCHOR_RJ",
    "photographer": "CAR_PHOTOGRAPHER", "video editor": "CAR_VIDEO_EDITOR", "film director": "CAR_FILMMAKER",
    "director": "CAR_FILMMAKER", "youtuber": "CAR_CONTENT_CREATOR", "influencer": "CAR_CONTENT_CREATOR",
    "chef": "CAR_CHEF", "cook": "CAR_CHEF", "gym trainer": "CAR_FITNESS_TRAINER", "yoga teacher": "CAR_FITNESS_TRAINER",
    "yoga instructor": "CAR_FITNESS_TRAINER", "fitness trainer": "CAR_FITNESS_TRAINER", "makeup artist": "CAR_MAKEUP_ARTIST",
    "doctor": "CAR_DOCTOR_MBBS", "mbbs": "CAR_DOCTOR_MBBS", "physician": "CAR_DOCTOR_MBBS", "surgeon": "CAR_SPECIALIST_DOCTOR",
    "specialist": "CAR_SPECIALIST_DOCTOR", "nurse": "CAR_NURSE", "nursing": "CAR_NURSE", "pharmacist": "CAR_PHARMACIST",
    "lab technician": "CAR_MEDICAL_LAB_TECH", "lawyer": "CAR_LAWYER", "advocate": "CAR_LAWYER", "corporate lawyer": "CAR_CORPORATE_LAWYER",
    "judge": "CAR_JUDGE", "paralegal": "CAR_LEGAL_ANALYST", "army officer": "CAR_ARMED_FORCES_OFFICER",
    "navy officer": "CAR_ARMED_FORCES_OFFICER", "army": "CAR_ARMED_FORCES_OFFICER", "nda": "CAR_ARMED_FORCES_OFFICER",
    "pilot": "CAR_AIR_FORCE_PILOT", "fighter pilot": "CAR_AIR_FORCE_PILOT", "soldier": "CAR_SOLDIER", "agniveer": "CAR_SOLDIER",
    "agriculture officer": "CAR_AGRI_OFFICER", "agronomist": "CAR_AGRI_OFFICER", "farmer": "CAR_AGRI_ENTREPRENEUR",
    "agricultural scientist": "CAR_AGRI_SCIENTIST", "electrician": "CAR_ELECTRICIAN", "fitter": "CAR_FITTER_MACHINIST",
    "machinist": "CAR_FITTER_MACHINIST", "welder": "CAR_WELDER", "mechanic": "CAR_AUTO_MECHANIC", "plumber": "CAR_PLUMBER",
}
STAGE_ALIASES = {
    "class 10": "EDU_CLASS_10", "10th": "EDU_CLASS_10", "pcm": "EDU_12_PCM", "pcb": "EDU_12_PCB",
    "12th science": "EDU_12_PCM", "commerce": "EDU_12_COMMERCE", "12th commerce": "EDU_12_COMMERCE",
    "humanities": "EDU_12_HUMANITIES", "arts": "EDU_12_HUMANITIES", "diploma": "EDU_DIPLOMA_CS",
    "btech cse": "EDU_BTECH_CSE", "b tech cse": "EDU_BTECH_CSE", "btech": "EDU_BTECH_CSE", "b tech": "EDU_BTECH_CSE",
    "ece": "EDU_BTECH_ECE", "mechanical": "EDU_BTECH_MECH", "bca": "EDU_BCA",
    "bsc cs": "EDU_BSC_CS", "bsc": "EDU_BSC_MATH_STATS", "b sc": "EDU_BSC_MATH_STATS", "bcom": "EDU_BCOM",
    "b com": "EDU_BCOM", "ba": "EDU_BA", "mtech": "EDU_MTECH_CSE", "m tech": "EDU_MTECH_CSE", "mca": "EDU_MCA",
    "mba": "EDU_MBA", "phd": "EDU_PHD_CS", "iti": "EDU_ITI", "llb": "EDU_LLB_3YR", "ba llb": "EDU_LLB_5YR",
    "b pharm": "EDU_BPHARM", "bpharm": "EDU_BPHARM", "bsc nursing": "EDU_BSC_NURSING", "bsc agriculture": "EDU_BSC_AGRI",
    "md": "EDU_MD_MS", "ms surgery": "EDU_MD_MS",
}
SUGGESTIONS_DEFAULT = ["What should I do next?", "Which careers suit me?", "What skills should I learn first?",
                       "Which scholarships can I apply for?"]


@dataclass
class Reply:
    intent: str
    text: str
    actions: list[dict] = field(default_factory=list)  # [{"label", "link"}]
    suggestions: list[str] = field(default_factory=list)
    career_id: str | None = None  # remembered for follow-up questions

    def as_dict(self) -> dict:
        return {"intent": self.intent, "text": self.text, "actions": self.actions,
                "suggestions": self.suggestions, "career_id": self.career_id}


# ---------------------------------------------------------------- entity extraction
def _words(text: str) -> str:
    return " " + re.sub(r"[^a-z0-9+#]+", " ", normalize(text).replace(".", "")) + " "


def find_careers(catalog: Catalog, message: str) -> list[str]:
    """Careers mentioned, in the order they appear."""
    text = _words(message)
    spans: dict[str, tuple[int, int]] = {}
    names = {normalize(c.name.split("(")[0]).replace("/", " "): c.career_id for c in catalog.careers.values()}
    for label, cid in [*names.items(), *CAREER_ALIASES.items()]:
        label = " " + re.sub(r"[^a-z0-9+#]+", " ", label).strip() + " "
        pos = text.find(label)
        if pos >= 0 and cid in catalog.careers:
            span = (pos, pos + len(label))
            # Earliest mention wins; at the same position the longer label wins
            if cid not in spans or span[0] < spans[cid][0] or (span[0] == spans[cid][0] and span[1] > spans[cid][1]):
                spans[cid] = span
    # "designer" inside "fashion designer" is not a separate mention
    inside = {cid for cid, (a, b) in spans.items()
              if any(o != cid and oa <= a and b <= ob and (ob - oa) > (b - a) for o, (oa, ob) in spans.items())}
    return [cid for cid, _ in sorted(spans.items(), key=lambda x: x[1][0]) if cid not in inside]


def find_stage(message: str) -> str | None:
    text = _words(message)
    for label in sorted(STAGE_ALIASES, key=len, reverse=True):
        if f" {label} " in text:
            return STAGE_ALIASES[label]
    return None


def find_exam(catalog: Catalog, message: str) -> str | None:
    text = _words(message)
    for exam in sorted(catalog.exams.values(), key=lambda e: -len(e.name)):
        if f" {_words(exam.name).strip()} " in text:
            return exam.exam_id
    return None


def _has(message: str, *patterns: str) -> bool:
    text = _words(message)
    return any(re.search(p, text) for p in patterns)


# ---------------------------------------------------------------- helpers
def _career_link(catalog: Catalog, cid: str) -> dict:
    return {"label": catalog.career_name(cid), "link": f"/careers/{cid}"}


def _default_career(catalog: Catalog, ctx: UserContext, remembered: str | None, target: str | None) -> str | None:
    if remembered:
        return remembered
    if target:
        return target
    if ctx.has_profile:
        items = recommend(catalog, ctx, limit=1)["items"]
        if items:
            return items[0]["career_id"]
    return None


def _need_profile() -> Reply:
    return Reply("need_profile", "I can answer that better once you have a profile. Add your education, skills and goals, "
                 "and I'll use them in every answer.", [{"label": "Create your profile", "link": "/profile/edit"}],
                 SUGGESTIONS_DEFAULT)


def _list(items: list[str]) -> str:
    return "\n".join(f"- {i}" for i in items)


# ---------------------------------------------------------------- intents
def _greeting(ctx: UserContext) -> Reply:
    name = f", {ctx.name.split()[0]}" if ctx.name else ""
    return Reply("greeting", f"Hi{name}! I'm your career mentor. I use your profile, test results and the Career "
                 "Compass data to answer. You can ask me things like:\n" + _list([
                     "What should I do after my degree?", "Can I become a data scientist?",
                     "What skills do I need for cloud engineering?", "Which exams should I take?",
                     "Compare data analyst and data scientist"]), [], SUGGESTIONS_DEFAULT)


def _next_steps(catalog: Catalog, ctx: UserContext, stage_id: str | None) -> Reply:
    stage_id = stage_id or ctx.stage.stage_id
    if not stage_id:
        return _need_profile()
    r = next_steps(catalog, stage_id, ctx)
    lines = []
    for key, label in (("education", "Study further"), ("career", "Start a career"), ("exam", "Exams")):
        for o in r["groups"][key][:2]:
            extra = f" ({o['duration_years']:g} years)" if o.get("duration_years") else ""
            exams = f", via {' / '.join(e['name'] for e in o['exams'])}" if o["exams"] else ""
            lines.append(f"{label}: {o['title']}{extra}{exams}. Next action: {o['next_action']}")
    text = f"From {r['stage']['name']}, here are your strongest next steps:\n" + _list(lines)
    if r["switches"]:
        s = r["switches"][0]
        text += f"\n\nA common switch from here is {s['title']} (about {s['months_min']}–{s['months_max']} months)."
    return Reply("next_steps", text, [{"label": "See all next steps", "link": f"/next-steps?stage={stage_id}"}],
                 ["Which careers suit me?", "Which exams should I take?", "Can I become a data scientist?"])


def _recommend(catalog: Catalog, ctx: UserContext) -> Reply:
    if not ctx.has_profile:
        return _need_profile()
    rec = recommend(catalog, ctx, limit=3)
    if not rec["items"]:
        return _need_profile()
    lines = [f"{i['name']} – {i['score']:.0f}/100. " + ("; ".join(i["strengths"][:2]) or "Fits your profile") + "."
             for i in rec["items"]]
    text = "Based on your profile, your best matches are:\n" + _list(lines)
    conf = rec["confidence"]
    text += f"\n\nConfidence: {conf['percent']}% ({conf['level']})."
    if conf["improve"]:
        text += " To make this more accurate: " + ", ".join(t["text"].lower() for t in conf["improve"][:2]) + "."
    top = rec["items"][0]["career_id"]
    return Reply("recommend", text, [{"label": "All recommendations", "link": "/for-you"}, _career_link(catalog, top)],
                 [f"What skills do I need for {rec['items'][0]['name']}?", f"Roadmap for {rec['items'][0]['name']}",
                  f"Compare {rec['items'][0]['name']} and {rec['items'][1]['name']}" if len(rec["items"]) > 1 else "What should I do next?"],
                 top)


def _transition(catalog: Catalog, ctx: UserContext, cid: str, stage_id: str | None) -> Reply:
    start_stage = stage_id or ctx.stage.stage_id
    start_career = None if stage_id else ctx.current_career_id
    if not start_stage and not start_career:
        return _need_profile()
    r = check_transition(catalog, ctx, cid, from_stage=start_stage, from_career=start_career)
    verdicts = {"direct": "Yes – it's a direct route from where you are.",
                "achievable": "Yes – there is a clear route, with some extra steps.",
                "hard": "Possible, but hard: there is no recorded route from where you are.",
                "not_direct": "Not directly from where you are."}
    parts = [verdicts[r["verdict"]], *r["reasons"]]
    if r["education_route"] and len(r["education_route"]) > 1:
        parts.append("Study route: " + " → ".join(s["title"] for s in r["education_route"]) + ".")
    if r["switch"]:
        parts.append("Switch plan: " + "; ".join(r["switch"]["steps"][:4]) + ".")
    if r["blockers"]:
        parts.append("Check first: " + " ".join(r["blockers"][:2]))
    sk = r["skills"]
    if sk["learn_first"]:
        parts.append(f"You have {sk['core_ready']} of {sk['core_total']} core skills; start with "
                     + ", ".join(sk["learn_first"][:3]) + ".")
    if r["alternatives"]:
        parts.append("Closer options: " + ", ".join(a["name"] for a in r["alternatives"]) + ".")
    name = catalog.career_name(cid)
    q = f"to={cid}" + (f"&from_stage={stage_id}" if stage_id else "")
    return Reply("transition", "\n\n".join(parts),
                 [{"label": "Full dream check", "link": f"/dream-check?{q}"}, {"label": "Roadmap", "link": f"/roadmap?career={cid}"}],
                 [f"What skills do I need for {name}?", f"Roadmap for {name}", "Which careers suit me?"], cid)


def _skills(catalog: Catalog, ctx: UserContext, cid: str) -> Reply:
    g = skill_gap(catalog, ctx, cid)
    name = g["career"]["name"]
    first = [f"{i['name']} ({i['current_level'] if i['current_level'] != 'none' else 'new'} → {i['required_level']})"
             for i in g["learn_first"][:5]]
    text = f"For {name} you are about {g['readiness']:.0f}% ready ({g['core_ready']} of {g['core_total']} core skills)."
    if first:
        text += "\n\nLearn these first:\n" + _list(first)
        text += f"\n\nRough time for the core skills: {g['estimate']['core_weeks']} weeks at about 8 hours a week."
    else:
        text += " You already have every core skill – focus on projects and applying."
    if g["have"]:
        text += "\n\nYou already have: " + ", ".join(i["name"] for i in g["have"][:6]) + "."
    if not g["has_skills"]:
        text += "\n\n(Your profile has no recognised skills yet, so everything counts as a gap.)"
    return Reply("skills", text, [{"label": "Full skill gap", "link": f"/skill-gap?career={cid}"},
                                  {"label": "Roadmap", "link": f"/roadmap?career={cid}"}],
                 [f"Roadmap for {name}", f"Can I become a {name}?", "Which careers suit me?"], cid)


def _roadmap(catalog: Catalog, ctx: UserContext, cid: str, done: set[str]) -> Reply:
    r = build_roadmap(catalog, ctx, cid, done)
    lines = []
    for s in r["stages"]:
        items = [i.get("name") or i.get("title") for i in s["items"] if not i.get("done")][:4]
        weeks = f" (~{s['weeks']} weeks)" if s["weeks"] and s["key"] != "study" else ""
        lines.append(f"{s['order']}. {s['title']}{weeks}: {', '.join(items)}")
    text = f"Your roadmap to {r['career']['name']}:\n" + "\n".join(lines)
    if r["skipped"]:
        text += "\n\nSkipped because you already know them: " + ", ".join(s["name"] for s in r["skipped"][:6]) + "."
    return Reply("roadmap", text, [{"label": "Open the roadmap", "link": f"/roadmap?career={cid}"}],
                 [f"What skills do I need for {r['career']['name']}?", "Which exams should I take?"], cid)


def _exam(catalog: Catalog, ctx: UserContext, exam_id: str | None) -> Reply:
    if exam_id:
        e = catalog.exams[exam_id]
        text = (f"{e.name} ({e.full_name}) is conducted by {e.conducting_body}. {e.purpose}.\n\nEligibility: "
                f"{e.eligibility_summary}.")
        if e.typical_month:
            text += f"\nUsually held: {e.typical_month}."
        text += "\n\nThis is not yet verified for the current year – check the official bulletin before applying."
        return Reply("exam", text, [{"label": f"{e.name} official website", "link": e.official_url}],
                     ["Which exams should I take?", "What should I do next?"])
    stage_id = ctx.stage.stage_id
    if not stage_id:
        return _need_profile()
    exams = sorted((e for e in catalog.exams.values() if stage_id in e.eligible_stage_ids), key=lambda e: e.name)
    if not exams:
        return Reply("exams", f"No exams in our list are open to {catalog.stage_name(stage_id)}.",
                     [{"label": "All exams", "link": "/resources"}], SUGGESTIONS_DEFAULT)
    text = f"Exams open to {catalog.stage_name(stage_id)}:\n" + _list(
        [f"{e.name} – {e.purpose}" + (f" (usually {e.typical_month})" if e.typical_month else "") for e in exams])
    return Reply("exams", text + "\n\nDates and rules change each year; confirm on the official sites.",
                 [{"label": "Exams list with official links", "link": "/resources?tab=exams&mine=1"}],
                 [f"Tell me about {exams[0].name}", "Which scholarships can I apply for?"])


def _scholarships(catalog: Catalog, ctx: UserContext, db) -> Reply:
    stage_id = ctx.stage.stage_id
    rows = db.query(Scholarship).order_by(Scholarship.name).all()
    if stage_id:
        rows = [s for s in rows if stage_id in s.eligible_stage_ids]
    if not rows:
        return Reply("scholarships", "I couldn't find scholarships for your stage in our list yet. The National "
                     "Scholarship Portal lists most government schemes.",
                     [{"label": "National Scholarship Portal", "link": "https://scholarships.gov.in/"}], SUGGESTIONS_DEFAULT)
    head = f"Scholarships that may fit {catalog.stage_name(stage_id)}" if stage_id else "Scholarships in our list"
    lines = [f"{s.name} ({s.provider}) – {s.eligibility_summary}" for s in rows[:6]]
    return Reply("scholarships", head + ":\n" + _list(lines) + "\n\nEach has its own income, category and deadline "
                 "rules, and none are verified for this year yet – check the official page.",
                 [{"label": "All scholarships", "link": "/resources?tab=scholarships&mine=1"}],
                 ["Which exams should I take?", "What should I do next?"])


def _colleges(catalog: Catalog, ctx: UserContext, db, cid: str | None, stage_id: str | None = None) -> Reply:
    rows = db.query(College).order_by(College.name).all()
    stage_ids = set()
    if stage_id:
        stage_ids = {stage_id}
    elif cid:
        stage_ids = {p.from_stage_id for p in catalog.paths_to_career(cid)}
    elif ctx.stage.stage_id:
        stage_ids = {p.to_id for p in catalog.paths_from(ctx.stage.stage_id) if p.to_type == "education"}
    picked = [c for c in rows if stage_ids & set(c.stage_ids_offered)] if stage_ids else rows
    lines = [f"{c.name} ({c.city or c.state})" + (f" – admission via {', '.join(catalog.exams[e].name for e in c.accepted_exam_ids if e in catalog.exams)}"
                                                    if c.accepted_exam_ids else "") for c in picked[:6]]
    text = "Some well-known institutes for your next step:\n" if stage_ids else "Some well-known institutes in our list:\n"
    return Reply("colleges", text + _list(lines) + "\n\nThis is a starter list, not a ranking. Check fees and cut-offs "
                 "on each official website.", [{"label": "Colleges list", "link": "/resources?tab=colleges"}],
                 ["Which exams should I take?", "Which scholarships can I apply for?"])


def _salary(catalog: Catalog, cid: str | None) -> Reply:
    career = catalog.careers.get(cid) if cid else None
    text = ("I don't give salary numbers: they vary a lot by city, company and experience, and I only use data I can "
            "source. ")
    if career and career.salary_note:
        text += f"What our data says about {career.name}: {career.salary_note}. "
    text += ("For current figures, look at official labour statistics or recent job postings for your city.")
    actions = [_career_link(catalog, cid)] if cid else []
    return Reply("salary", text, actions, ["Which careers suit me?", "What should I do next?"], cid)


def _compare(catalog: Catalog, ctx: UserContext, a: str, b: str) -> Reply:
    reach = reachable_careers(catalog, ctx.stage.stage_id)
    rows = []
    for cid in (a, b):
        c = catalog.careers[cid]
        item = score_career(catalog, ctx, c, reach)
        gap = skill_gap(catalog, ctx, cid)
        fit = f"match {item['score']:.0f}/100" if ctx.has_profile else "log in for your match score"
        rows.append(f"{c.name}: {c.description}. {fit}; you have {gap['core_ready']} of {gap['core_total']} core "
                    f"skills; usual minimum education: {LEVEL_WORDS.get(c.min_education_level, c.min_education_level)}.")
    better = None
    if ctx.has_profile:
        sa = score_career(catalog, ctx, catalog.careers[a], reach)["score"]
        sb = score_career(catalog, ctx, catalog.careers[b], reach)["score"]
        if abs(sa - sb) >= 3:
            better = catalog.career_name(a if sa > sb else b)
    text = _list(rows)
    text += (f"\n\nFor you, {better} fits a little better right now." if better else
             "\n\nThey fit you about equally; pick the one whose daily work you'd enjoy more.")
    return Reply("compare", text, [_career_link(catalog, a), _career_link(catalog, b)],
                 [f"What skills do I need for {catalog.career_name(a)}?", f"Can I become a {catalog.career_name(b)}?"], a)


def _career_info(catalog: Catalog, ctx: UserContext, cid: str) -> Reply:
    c = catalog.careers[cid]
    text = f"{c.name} ({c.domain}): {c.description}."
    if ctx.has_profile:
        item = score_career(catalog, ctx, c, reachable_careers(catalog, ctx.stage.stage_id))
        text += f"\n\nYour match: {item['score']:.0f}/100."
        if item["strengths"]:
            text += " " + "; ".join(item["strengths"][:2]) + "."
        if item["skills_to_learn"]:
            text += "\nCore skills to learn: " + ", ".join(item["skills_to_learn"][:4]) + "."
    return Reply("career", text, [_career_link(catalog, cid), {"label": "Skill gap", "link": f"/skill-gap?career={cid}"}],
                 [f"Can I become a {c.name}?", f"Roadmap for {c.name}", f"What skills do I need for {c.name}?"], cid)


def _fallback() -> Reply:
    return Reply("fallback", "I'm not sure I understood. I can help with next steps, which careers suit you, whether "
                 "you can reach a dream career, the skills to learn, roadmaps, exams, colleges and scholarships.",
                 [], SUGGESTIONS_DEFAULT)


# ---------------------------------------------------------------- router
def answer(catalog: Catalog, ctx: UserContext, message: str, db, remembered_career: str | None = None,
           target_career: str | None = None, done_skills: set[str] | None = None) -> Reply:
    msg = message.strip()
    careers = find_careers(catalog, msg)
    stage_id = find_stage(msg)
    exam_id = find_exam(catalog, msg)
    career = careers[0] if careers else None

    if _has(msg, r" (hi|hello|hey|namaste|help|what can you do) ") and not careers and len(msg) < 40:
        return _greeting(ctx)
    if _has(msg, r" salary ", r" pay ", r" package ", r" earn", r" income ", r" lpa ", r" ctc "):
        return _salary(catalog, career or remembered_career)
    if len(careers) >= 2 and _has(msg, r" vs ", r" versus ", r" compare", r" or ", r" better ", r" difference "):
        return _compare(catalog, ctx, careers[0], careers[1])
    if _has(msg, r" scholarship", r" financial aid ", r" fee waiver ", r" funding "):
        return _scholarships(catalog, ctx, db)
    if _has(msg, r" college", r" universit", r" institute", r" iit ", r" nit ", r" iim "):
        return _colleges(catalog, ctx, db, career, stage_id)
    if exam_id and not _has(msg, r" can i become ", r" switch "):
        return _exam(catalog, ctx, exam_id)
    if _has(msg, r" exam", r" entrance ", r" test to ", r" competitive "):
        return _exam(catalog, ctx, None)
    asks_how = _has(msg, r" how (do|can|to|should|would) i ", r" how to ")
    if career and not asks_how and _has(msg, r" can i (become|be|get|switch|move|go)", r" switch (to|into) ", r" move (to|into) ",
                       r" become (a|an) ", r" possible ", r" transition "):
        return _transition(catalog, ctx, career, stage_id)
    wants_skills = _has(msg, r" skill", r" learn", r" study for ", r" prepare for ", r" gap ", r" missing ")
    wants_roadmap = _has(msg, r" roadmap ", r" plan ", r" how (do|can|to|should) i (become|get|start)", r" how to become ",
                         r" steps to ", r" path to ")
    if wants_roadmap and (career or remembered_career or target_career or ctx.has_profile):
        cid = career or _default_career(catalog, ctx, remembered_career, target_career)
        if cid:
            return _roadmap(catalog, ctx, cid, done_skills if cid == target_career else set())
    if wants_skills:
        cid = career or _default_career(catalog, ctx, remembered_career, target_career)
        if cid:
            return _skills(catalog, ctx, cid)
        return _need_profile()
    if _has(msg, r" suit", r" which career", r" what career", r" best career", r" recommend", r" good for me ",
            r" right career", r" match"):
        return _recommend(catalog, ctx)
    if _has(msg, r" next", r" after (my|the|12|10|class|graduation|degree|btech|bca|bcom)", r" option", r" what (should|can) i do",
            r" confused", r" future ", r" what now ") or (stage_id and not career):
        return _next_steps(catalog, ctx, stage_id)
    if career:
        return _career_info(catalog, ctx, career)
    return _fallback()
