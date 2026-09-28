"""Career Explorer: the datasets as a tree you can expand step by step.

stage  -> further study, careers and exams it leads to
career -> promotions, specialisations and switches from it
exam   -> leaf"""
from engine.catalog_data import Catalog


class UnknownNode(LookupError):
    pass


def _career_has_children(catalog: Catalog, career_id: str) -> bool:
    return any(p.from_career_id == career_id for p in catalog.career_paths) or any(
        t.from_type == "career" and t.from_id == career_id for t in catalog.transitions)


def node_info(catalog: Catalog, kind: str, node_id: str) -> dict:
    if kind == "stage" and node_id in catalog.stages:
        s = catalog.stages[node_id]
        return {"type": "stage", "id": node_id, "title": s.name, "subtitle": s.description,
                "has_children": bool(catalog.paths_from(node_id))}
    if kind == "career" and node_id in catalog.careers:
        c = catalog.careers[node_id]
        return {"type": "career", "id": node_id, "title": c.name, "subtitle": c.domain,
                "has_children": _career_has_children(catalog, node_id)}
    if kind == "exam" and node_id in catalog.exams:
        e = catalog.exams[node_id]
        return {"type": "exam", "id": node_id, "title": e.name, "subtitle": e.full_name, "has_children": False,
                "url": e.official_url}
    raise UnknownNode(f"{kind}:{node_id}")


def children(catalog: Catalog, kind: str, node_id: str) -> list[dict]:
    node_info(catalog, kind, node_id)  # validates
    result = []
    if kind == "stage":
        for p in catalog.paths_from(node_id):
            to_kind = "stage" if p.to_type == "education" else p.to_type
            try:
                child = node_info(catalog, to_kind, p.to_id)
            except UnknownNode:
                continue
            exams = [catalog.exams[e].name for e in p.required_exam_ids if e in catalog.exams and e != p.to_id]
            child["edge"] = {
                "label": {"education": "Study", "career": "Career", "exam": "Exam"}[p.to_type],
                "years": p.duration_years or (catalog.stages[p.to_id].typical_duration_years if to_kind == "stage" else None),
                "exams": exams,
            }
            result.append(child)
    elif kind == "career":
        for p in catalog.career_paths:
            if p.from_career_id == node_id and p.to_career_id in catalog.careers:
                child = node_info(catalog, "career", p.to_career_id)
                child["edge"] = {"label": p.transition_type.capitalize(), "years": None,
                                 "experience": p.typical_years_experience, "exams": []}
                result.append(child)
        for t in catalog.transitions:
            # Skip switches to careers already listed as a normal progression
            if t.from_type == "career" and t.from_id == node_id and t.to_career_id in catalog.careers \
                    and t.to_career_id not in {c["id"] for c in result}:
                child = node_info(catalog, "career", t.to_career_id)
                child["edge"] = {"label": "Switch", "years": None, "exams": [],
                                 "months": f"{t.estimated_months_min}–{t.estimated_months_max}"}
                result.append(child)
    order = {"stage": 0, "career": 1, "exam": 2}
    result.sort(key=lambda c: (order[c["type"]], c["title"]))
    return result
