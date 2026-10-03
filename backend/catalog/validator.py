"""Checks every dataset CSV against catalog/schema.py.

Run from the backend folder:
    python -m catalog.validator            # prints a report, exit code 1 on errors
Errors block loading the data; warnings are shown but allowed.
"""
import csv
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

from catalog.schema import DATASETS_DIR, ID_COLUMNS, PLANNED_FILES, SPECS, FileSpec

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
URL_RE = re.compile(r"^https?://[^\s/$.?#][^\s]*$")


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    counts: dict[str, int] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not self.errors

    def error(self, file: str, row: int | None, message: str) -> None:
        self.errors.append(f"{file}{f' row {row}' if row else ''}: {message}")

    def warn(self, file: str, row: int | None, message: str) -> None:
        self.warnings.append(f"{file}{f' row {row}' if row else ''}: {message}")


def split_ids(value: str) -> list[str]:
    return [part.strip() for part in value.split("|") if part.strip()]


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    # utf-8-sig: tolerate a byte-order mark added by Excel
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        header = reader.fieldnames or []
        rows = [{k: (v or "").strip() for k, v in row.items() if k is not None} for row in reader]
    return header, rows


def load_all(data_dir: Path, report: Report) -> dict[str, list[dict[str, str]]]:
    tables: dict[str, list[dict[str, str]]] = {}
    for name in [*SPECS, *PLANNED_FILES]:
        path = data_dir / name
        if not path.exists():
            report.error(name, None, "file is missing")
            continue
        try:
            header, rows = read_csv(path)
        except (UnicodeDecodeError, csv.Error) as exc:
            report.error(name, None, f"cannot be read as UTF-8 CSV ({exc})")
            continue
        spec = SPECS.get(name)
        if spec and tuple(header) != spec.columns:
            missing = [c for c in spec.columns if c not in header]
            extra = [c for c in header if c not in spec.columns]
            report.error(name, None, f"header mismatch (missing: {missing or '-'}, unexpected: {extra or '-'})")
        elif not spec and PLANNED_FILES[name] not in header:
            report.error(name, None, f"header must contain '{PLANNED_FILES[name]}'")
        tables[name] = rows
        report.counts[name] = len(rows)
    return tables


def check_rows(spec: FileSpec, rows: list[dict[str, str]], report: Report) -> None:
    name = spec.name
    seen: dict[str, int] = {}
    for line, row in enumerate(rows, start=2):  # line 1 is the header
        for column in spec.required:
            if not row.get(column):
                report.error(name, line, f"'{column}' is required")

        if spec.id_column and (row_id := row.get(spec.id_column)):
            if row_id in seen:
                report.error(name, line, f"duplicate id '{row_id}' (first on row {seen[row_id]})")
            seen.setdefault(row_id, line)
            if spec.id_prefix and not row_id.startswith(spec.id_prefix):
                report.error(name, line, f"id '{row_id}' must start with '{spec.id_prefix}'")
            if not re.fullmatch(r"[A-Z0-9_]+", row_id):
                report.error(name, line, f"id '{row_id}' may only use A-Z, 0-9 and _")

        for column, allowed in spec.enums.items():
            for value in split_ids(row.get(column, "")):
                if value not in allowed:
                    report.error(name, line, f"'{column}' has invalid value '{value}'")

        for column, (low, high) in spec.int_ranges.items():
            value = row.get(column, "")
            if value and (not value.lstrip("-").isdigit() or not low <= int(value) <= high):
                report.error(name, line, f"'{column}' must be a whole number from {low} to {high}")

        for column in spec.numbers:
            value = row.get(column, "")
            if value:
                try:
                    if float(value) < 0:
                        raise ValueError
                except ValueError:
                    report.error(name, line, f"'{column}' must be a non-negative number")

        for column in spec.booleans:
            if row.get(column) and row[column] not in ("true", "false"):
                report.error(name, line, f"'{column}' must be 'true' or 'false'")

        for column in spec.dates:
            value = row.get(column, "")
            if value:
                try:
                    if not DATE_RE.match(value):
                        raise ValueError
                    if date.fromisoformat(value) > date.today():
                        report.error(name, line, f"'{column}' is in the future")
                except ValueError:
                    report.error(name, line, f"'{column}' must be a real date in YYYY-MM-DD format")

        for column in spec.urls:
            value = row.get(column, "")
            if value and not URL_RE.match(value):
                report.error(name, line, f"'{column}' is not a valid http(s) URL")

    if spec.unique_together:
        pairs: dict[tuple, int] = {}
        for line, row in enumerate(rows, start=2):
            key = tuple(row.get(c, "") for c in spec.unique_together)
            if key in pairs:
                report.error(name, line, f"duplicate {spec.unique_together} {key} (first on row {pairs[key]})")
            pairs.setdefault(key, line)


def check_foreign_keys(tables: dict[str, list[dict[str, str]]], report: Report) -> None:
    ids = {name: {row.get(col, "") for row in tables.get(name, [])} for name, col in ID_COLUMNS.items()}

    for name, spec in SPECS.items():
        for line, row in enumerate(tables.get(name, []), start=2):
            for column, target in spec.foreign_keys.items():
                for ref in split_ids(row.get(column, "")):
                    if ref not in ids.get(target, set()):
                        report.error(name, line, f"'{column}' refers to unknown id '{ref}' in {target}")

    # Polymorphic references: the target file depends on another column
    by_type = {"education": "education_stages.csv", "career": "careers.csv", "exam": "entrance_exams.csv"}
    for line, row in enumerate(tables.get("education_paths.csv", []), start=2):
        target = by_type.get(row.get("to_type", ""))
        if target and row.get("to_id") and row["to_id"] not in ids[target]:
            report.error("education_paths.csv", line, f"'to_id' '{row['to_id']}' not found in {target}")
        if row.get("from_stage_id") and row.get("from_stage_id") == row.get("to_id"):
            report.error("education_paths.csv", line, "a stage cannot lead to itself")
    for line, row in enumerate(tables.get("career_transition_paths.csv", []), start=2):
        target = by_type.get(row.get("from_type", ""))
        if target and row.get("from_id") and row["from_id"] not in ids[target]:
            report.error("career_transition_paths.csv", line, f"'from_id' '{row['from_id']}' not found in {target}")


def check_logic(tables: dict[str, list[dict[str, str]]], report: Report) -> None:
    """Rules that span columns or files (the 'graph' checks)."""
    skills = tables.get("skills.csv", [])
    names: dict[str, int] = {}
    for line, row in enumerate(skills, start=2):
        key = row.get("skill_name", "").casefold()
        if key and key in names:
            report.error("skills.csv", line, f"duplicate skill name '{row.get('skill_name')}' (row {names[key]})")
        names.setdefault(key, line)

    for line, row in enumerate(tables.get("career_paths.csv", []), start=2):
        if row.get("from_career_id") == row.get("to_career_id"):
            report.error("career_paths.csv", line, "a career cannot lead to itself")

    for line, row in enumerate(tables.get("career_transition_paths.csv", []), start=2):
        low, high = row.get("estimated_months_min", ""), row.get("estimated_months_max", "")
        if low.isdigit() and high.isdigit() and int(low) > int(high):
            report.error("career_transition_paths.csv", line, "estimated_months_min is greater than max")

    careers = tables.get("careers.csv", [])
    mapping = tables.get("skill_career_mapping.csv", [])
    per_career: dict[str, list[dict]] = defaultdict(list)
    for row in mapping:
        per_career[row.get("career_id", "")].append(row)
    for row in careers:
        cid = row.get("career_id", "")
        links = per_career.get(cid, [])
        if len(links) < 3:
            report.error("skill_career_mapping.csv", None, f"career '{cid}' has {len(links)} skills (need at least 3)")
        elif not any(link.get("is_mandatory") == "true" for link in links):
            report.warn("skill_career_mapping.csv", None, f"career '{cid}' has no mandatory skill")

    # Graph: every career must be reachable from some stage or career
    reachable = (
        {r.get("to_id", "") for r in tables.get("education_paths.csv", []) if r.get("to_type") == "career"}
        | {r.get("to_career_id", "") for r in tables.get("career_paths.csv", [])}
        | {r.get("to_career_id", "") for r in tables.get("career_transition_paths.csv", [])}
    )
    for row in careers:
        if row.get("career_id") not in reachable:
            report.error("careers.csv", None, f"career '{row.get('career_id')}' is not reachable by any path")

    # Graph: every stage except working professionals should lead somewhere
    starts = {r.get("from_stage_id", "") for r in tables.get("education_paths.csv", [])}
    for row in tables.get("education_stages.csv", []):
        if row.get("stage_id") not in starts:
            report.warn("education_stages.csv", None, f"stage '{row.get('stage_id')}' has no outgoing path yet")

    # Professional courses (music, dance, design, ...) are open to everyone: every stage must offer all of them
    stages = tables.get("education_stages.csv", [])
    courses = {r.get("stage_id", "") for r in stages if r.get("level") == "course"}
    offered: dict[str, set[str]] = defaultdict(set)
    for r in tables.get("education_paths.csv", []):
        if r.get("to_type") == "education" and r.get("to_id") in courses:
            offered[r.get("from_stage_id", "")].add(r["to_id"])
    for row in stages:
        sid = row.get("stage_id", "")
        if row.get("level") != "course" and courses - offered[sid]:
            report.error("education_paths.csv", None, f"stage '{sid}' is missing professional courses: "
                         + ", ".join(sorted(courses - offered[sid])))

    # Every career gets at least two project briefs with a usable checklist
    projects: dict[str, int] = defaultdict(int)
    for line, row in enumerate(tables.get("project_ideas.csv", []), start=2):
        steps = split_ids(row.get("steps", ""))
        if not 3 <= len(steps) <= 8:
            report.error("project_ideas.csv", line, f"needs 3 to 8 steps (has {len(steps)})")
        for cid in split_ids(row.get("career_ids", "")):
            projects[cid] += 1
    if "project_ideas.csv" in tables:
        for row in careers:
            if projects[row.get("career_id", "")] < 2:
                report.error("project_ideas.csv", None, f"career '{row.get('career_id')}' has fewer than 2 projects")

    # Salary rows: max is not below min, and only government (official) sources are allowed
    for line, row in enumerate(tables.get("salary_ranges.csv", []), start=2):
        lo, hi = row.get("monthly_min", ""), row.get("monthly_max", "")
        if lo.isdigit() and hi.isdigit() and int(hi) < int(lo):
            report.error("salary_ranges.csv", line, "monthly_max is below monthly_min")
        host = re.sub(r"^https?://", "", row.get("source_url", "")).split("/")[0].lower()
        if host and not (host.endswith(".gov.in") or host.endswith(".nic.in")):
            report.error("salary_ranges.csv", line, f"source must be an official .gov.in or .nic.in site (got {host})")

    for line, row in enumerate(tables.get("closing_ranks.csv", []), start=2):
        o, c = row.get("opening_rank", ""), row.get("closing_rank", "")
        if o.isdigit() and c.isdigit() and int(c) < int(o):
            report.error("closing_ranks.csv", line, "closing_rank is below opening_rank")

    # Hindi translations point at real entries and fields that exist for that type
    targets = {"career": ("careers.csv", "career_id", {"name", "description"}),
               "exam": ("entrance_exams.csv", "exam_id", {"name", "purpose"}),
               "stage": ("education_stages.csv", "stage_id", {"name"}),
               "skill": ("skills.csv", "skill_id", {"name", "description"})}
    for line, row in enumerate(tables.get("translations_hi.csv", []), start=2):
        target = targets.get(row.get("entity_type", ""))
        if target is None:
            continue
        file, column, fields = target
        if row.get("entity_id") not in {r.get(column) for r in tables.get(file, [])}:
            report.error("translations_hi.csv", line, f"unknown {row['entity_type']} '{row.get('entity_id')}'")
        if row.get("field") not in fields:
            report.error("translations_hi.csv", line, f"field '{row.get('field')}' cannot be translated for {row['entity_type']}")

    # Exact exam dates: end on/after start, and only from the exam's own official site
    exam_hosts = {r["exam_id"]: urlparse(r.get("official_url", "")).hostname or "" for r in tables.get("entrance_exams.csv", [])}
    for line, row in enumerate(tables.get("exam_dates.csv", []), start=2):
        try:
            start, end = date.fromisoformat(row.get("start_date", "")), date.fromisoformat(row.get("end_date", ""))
        except ValueError:
            report.error("exam_dates.csv", line, "start_date and end_date must be YYYY-MM-DD")
        else:
            if end < start:
                report.error("exam_dates.csv", line, "end_date is before start_date")
        host = urlparse(row.get("source_url", "")).hostname or ""
        if row.get("exam_id") in exam_hosts and host != exam_hosts[row["exam_id"]]:
            report.error("exam_dates.csv", line, f"source_url must be on the exam's official site ({exam_hosts[row['exam_id']]})")

    # Reliability: unverified exam info must link to the official source
    for line, row in enumerate(tables.get("entrance_exams.csv", []), start=2):
        if row.get("verified") == "false" and not row.get("official_url"):
            report.error("entrance_exams.csv", line, "unverified exam must have an official_url")

    check_question_banks(tables, report)


def check_question_banks(tables: dict[str, list[dict[str, str]]], report: Report) -> None:
    """Each score must rest on enough questions, and answers must be unambiguous."""
    from catalog.schema import (
        APTITUDE_CATEGORIES,
        MIN_PER_APTITUDE_CATEGORY,
        MIN_PER_RIASEC_TYPE,
        PERSONALITY_TRAITS,
        RIASEC_TYPES,
    )

    for name in ("interest_questions.csv", "personality_questions.csv", "aptitude_questions.csv"):
        seen: dict[str, int] = {}
        for line, row in enumerate(tables.get(name, []), start=2):
            text_key = " ".join(row.get("question_text", "").casefold().split())
            if text_key and text_key in seen:
                report.error(name, line, f"same question text as row {seen[text_key]}")
            seen.setdefault(text_key, line)

    interest = tables.get("interest_questions.csv", [])
    for code in sorted(RIASEC_TYPES):
        count = sum(r.get("riasec_type") == code for r in interest)
        if count < MIN_PER_RIASEC_TYPE:
            report.error("interest_questions.csv", None,
                         f"type '{code}' has {count} questions (need at least {MIN_PER_RIASEC_TYPE})")

    personality = tables.get("personality_questions.csv", [])
    for trait in sorted(PERSONALITY_TRAITS):
        keys = {r.get("keyed") for r in personality if r.get("trait") == trait}
        if not keys:
            report.error("personality_questions.csv", None, f"trait '{trait}' has no questions")
        elif keys != {"+", "-"}:
            # Without reversed items, someone who agrees with everything scores high on everything
            report.error("personality_questions.csv", None,
                         f"trait '{trait}' needs at least one '+' and one '-' keyed question")

    aptitude = tables.get("aptitude_questions.csv", [])
    for category in sorted(APTITUDE_CATEGORIES):
        count = sum(r.get("category") == category for r in aptitude)
        if count < MIN_PER_APTITUDE_CATEGORY:
            report.error("aptitude_questions.csv", None,
                         f"category '{category}' has {count} questions (need at least {MIN_PER_APTITUDE_CATEGORY})")
    for line, row in enumerate(aptitude, start=2):
        options = [row.get(f"option_{x}", "").casefold() for x in "abcd"]
        if all(options) and len(set(options)) < 4:
            report.error("aptitude_questions.csv", line, "two options have the same text")


def validate(data_dir: Path = DATASETS_DIR) -> tuple[Report, dict[str, list[dict[str, str]]]]:
    report = Report()
    tables = load_all(Path(data_dir), report)
    for name, spec in SPECS.items():
        if name in tables:
            check_rows(spec, tables[name], report)
    check_foreign_keys(tables, report)
    check_logic(tables, report)
    return report, tables


def main() -> int:
    report, _ = validate()
    for name, count in report.counts.items():
        print(f"  {name:32} {count:>4} rows")
    for warning in report.warnings:
        print(f"WARNING  {warning}")
    for error in report.errors:
        print(f"ERROR    {error}")
    print(f"\n{len(report.errors)} error(s), {len(report.warnings)} warning(s)")
    return 0 if report.ok else 1


if __name__ == "__main__":
    sys.exit(main())
