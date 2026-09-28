"""The validator must pass on the real data and catch every kind of mistake.
Each test copies the datasets to a temp folder, breaks one thing, and
checks that the validator reports it."""
import shutil

import pytest

from catalog.schema import DATASETS_DIR
from catalog.validator import validate


@pytest.fixture
def data_copy(tmp_path):
    target = tmp_path / "datasets"
    shutil.copytree(DATASETS_DIR, target)
    return target


def replace_in(path, old, new):
    text = path.read_text(encoding="utf-8")
    assert old in text, f"test setup: '{old}' not found in {path.name}"
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def append(path, line):
    with path.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def errors_for(folder):
    report, _ = validate(folder)
    return "\n".join(report.errors)


def test_real_datasets_are_valid():
    report, tables = validate()
    assert report.errors == []
    assert report.warnings == []
    assert len(tables["careers.csv"]) >= 30
    assert len(tables["skills.csv"]) >= 150


@pytest.mark.parametrize(
    "file,old,new,expected",
    [
        ("skills.csv", "SKL_JAVA,Java", "SKL_PYTHON,Java", "duplicate id 'SKL_PYTHON'"),
        ("skills.csv", "SKL_JAVA,Java", "SKL_JAVA2,python", "duplicate skill name"),
        ("skills.csv", "SKL_JAVA,Java,programming", "SKL_JAVA,Java,wizardry", "invalid value 'wizardry'"),
        ("skills.csv", "SKL_JAVA,Java", "SKILL_JAVA,Java", "must start with 'SKL_'"),
        ("careers.csv", "15-1252.00,,https://www.onetonline.org/link/summary/15-1252.00,2026-09-28",
         "15-1252.00,,ftp://bad,2026-09-28", "not a valid http(s) URL"),
        ("careers.csv", ",2026-09-28\n", ",2026-02-30\n", "real date"),
        ("careers.csv", ",2026-09-28\n", ",2999-01-01\n", "in the future"),
        ("careers.csv", "EDU_BTECH_CSE|EDU_BCA", "EDU_BTECH_CSE|EDU_NOPE", "unknown id 'EDU_NOPE'"),
        ("skill_career_mapping.csv", "CAR_SOFTWARE_ENGINEER,SKL_DSA,5", "CAR_SOFTWARE_ENGINEER,SKL_DSA,9",
         "whole number from 1 to 5"),
        ("skill_career_mapping.csv", "SKL_DSA,5,intermediate,true", "SKL_DSA,5,intermediate,yes",
         "'true' or 'false'"),
        ("skill_career_mapping.csv", "CAR_SOFTWARE_ENGINEER,SKL_ALGORITHMS", "CAR_SOFTWARE_ENGINEER,SKL_DSA",
         "duplicate ('career_id', 'skill_id')"),
        ("education_paths.csv", "EP_017,EDU_BTECH_CSE,career,CAR_SOFTWARE_ENGINEER",
         "EP_017,EDU_BTECH_CSE,career,CAR_GHOST", "'to_id' 'CAR_GHOST' not found"),
        ("education_paths.csv", "EP_001,EDU_CLASS_10,education,EDU_12_PCM",
         "EP_001,EDU_CLASS_10,education,EDU_CLASS_10", "cannot lead to itself"),
        ("education_paths.csv", "EDU_BTECH_MECH,EXM_JEE_MAIN", "EDU_BTECH_MECH,EXM_FAKE",
         "unknown id 'EXM_FAKE'"),
        ("career_transition_paths.csv", "CAR_DATA_SCIENTIST,medium,6,12", "CAR_DATA_SCIENTIST,medium,12,6",
         "min is greater than max"),
        ("career_transition_paths.csv", "TR_006,career,CAR_SCHOOL_TEACHER", "TR_006,career,CAR_NOBODY",
         "'from_id' 'CAR_NOBODY' not found"),
        ("career_paths.csv", "CP_001,CAR_SOFTWARE_ENGINEER,CAR_BACKEND_DEVELOPER",
         "CP_001,CAR_SOFTWARE_ENGINEER,CAR_SOFTWARE_ENGINEER", "a career cannot lead to itself"),
    ],
)
def test_validator_catches_mistakes(data_copy, file, old, new, expected):
    replace_in(data_copy / file, old, new)
    assert expected in errors_for(data_copy)


def test_missing_required_value(data_copy):
    replace_in(data_copy / "entrance_exams.csv", "https://jeemain.nta.nic.in/,false", ",false")
    errors = errors_for(data_copy)
    assert "'official_url' is required" in errors


def test_missing_file_and_bad_header(data_copy):
    (data_copy / "courses.csv").unlink()
    replace_in(data_copy / "skills.csv", "skill_id,skill_name", "skill_id,name")
    errors = errors_for(data_copy)
    assert "courses.csv: file is missing" in errors
    assert "skills.csv: header mismatch" in errors


def test_unreachable_career_and_too_few_skills(data_copy):
    append(
        data_copy / "careers.csv",
        "CAR_LONELY,Lonely Role,Technology,,Nobody gets here,ug,,I,logical,,,,,,https://example.org/,2026-09-28",
    )
    errors = errors_for(data_copy)
    assert "career 'CAR_LONELY' is not reachable" in errors
    assert "career 'CAR_LONELY' has 0 skills" in errors


def test_excel_byte_order_mark_is_accepted(data_copy):
    path = data_copy / "skills.csv"
    path.write_bytes(b"\xef\xbb\xbf" + path.read_bytes())
    assert errors_for(data_copy) == ""



@pytest.mark.parametrize(
    "file,old,new,expected",
    [
        ("interest_questions.csv", "IQ_R01,Build or repair things with tools,R",
         "IQ_R01,Build or repair things with tools,X", "invalid value 'X'"),
        ("interest_questions.csv", "IQ_R02,Assemble electronic parts or circuits",
         "IQ_R02,Build or repair things with tools", "same question text"),
        ("personality_questions.csv", "PQ_L02,I prefer that someone else makes the decisions in a group.,leadership,-",
         "PQ_L02,I prefer that someone else makes the decisions in a group.,leadership,+",
         "trait 'leadership' needs at least one '+' and one '-'"),
        ("personality_questions.csv", "extraversion,+,1-5", "extraversion,+,1-7", "invalid value '1-7'"),
        ("aptitude_questions.csv", ",₹1000,₹1040,₹1200,b,", ",₹1000,₹1040,₹1200,e,", "invalid value 'e'"),
        ("aptitude_questions.csv", "₹960,₹1000,₹1040", "₹960,₹960,₹1040", "two options have the same text"),
    ],
)
def test_question_bank_mistakes(data_copy, file, old, new, expected):
    replace_in(data_copy / file, old, new)
    assert expected in errors_for(data_copy)


def test_too_few_questions_for_a_scale(data_copy):
    path = data_copy / "interest_questions.csv"
    lines = [l for l in path.read_text(encoding="utf-8").splitlines() if not l.startswith("IQ_C0")]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    assert "type 'C' has 0 questions" in errors_for(data_copy)
