# Career Compass AI – Data Requirements

Data dictionary for every CSV in `datasets/`. The recommendation quality depends on this data, so fill it carefully.

---

## 1. Conventions (apply to all files)

| Rule | Format | Example |
|---|---|---|
| Encoding | UTF-8, comma-separated, first row = header | |
| IDs | `PREFIX_NNN` or readable code, unique, never reused | `CAR_001`, `SKL_014`, `EDU_BTECH_CSE` |
| Multi-value fields | Pipe `\|` separated IDs, no spaces | `SKL_001\|SKL_002` |
| Booleans | `true` / `false` | |
| Dates | `YYYY-MM-DD` | `2026-09-27` |
| Text containing commas | Wrap in double quotes | `"Python, SQL basics"` |
| Missing value | Leave empty (not `NA`, not `-`) | |

Verification fields (required on time-sensitive data):

| Field | Meaning |
|---|---|
| `source_url` | Official page the data came from |
| `verified` | `true` only if checked on an official source |
| `last_verified` | Date you checked it |

Salary / outcome fields are always indicative notes, never guarantees.

---

## 2. ID Prefixes

| Prefix | Entity | File |
|---|---|---|
| `EDU_` | Education stage (graph node) | education_stages.csv |
| `CAR_` | Career | careers.csv |
| `SKL_` | Skill | skills.csv |
| `EXM_` | Entrance exam | entrance_exams.csv |
| `CRS_` | Course | courses.csv |
| `CRT_` | Certification | certifications.csv |
| `COL_` | College | colleges.csv |
| `UNI_` | University | universities.csv |
| `SCH_` | Scholarship | scholarships.csv |
| `EP_` | Education path (edge) | education_paths.csv |
| `CP_` | Career path (edge) | career_paths.csv |
| `TR_` | Career transition | career_transition_paths.csv |
| `RM_` | Roadmap stage | career_roadmaps.csv |
| `IQ_` / `PQ_` / `AQ_` | Interest / personality / aptitude question | *_questions.csv |

---

## 3. How the files connect

```
education_stages ──(education_paths)──► education_stages / careers / exams
       │
careers ──(career_paths)──► careers                (progression in same field)
careers ◄──(career_transition_paths)── education_stages / careers   (switches)
careers ──(skill_career_mapping)──► skills
careers ──(career_roadmaps)──► ordered stages ──► skills, courses
skills ◄── courses, certifications
entrance_exams ◄── colleges (accepted exams), education_paths (required exams)
scholarships ──► education_stages (who is eligible)
```

`education_stages.csv` was added to the original dataset list: the Next Step Engine needs a node list for "where the user is now".

---

## 4. File Definitions

### 4.1 education_stages.csv (graph nodes)

| Field | Type | Required | Description |
|---|---|---|---|
| stage_id | string | yes | `EDU_12_PCM`, `EDU_BTECH_CSE`, `EDU_MTECH_CSE` |
| stage_name | string | yes | "Class 12 – PCM", "B.Tech CSE" |
| level | enum | yes | `school`, `course` (professional course such as music, dance, design, acting or culinary; no degree needed), `diploma`, `ug`, `pg`, `doctoral`, `professional` |
| stream_or_branch | string | no | "PCM", "Computer Science" |
| typical_duration_years | number | no | 4 |
| description | text | no | Short description |

### 4.2 careers.csv

| Field | Type | Required | Description |
|---|---|---|---|
| career_id | string | yes | `CAR_001` |
| career_name | string | yes | "Machine Learning Engineer" |
| domain | string | yes | "Technology", "Business", "Healthcare" |
| sub_domain | string | no | "AI/ML" |
| description | text | yes | 1–3 sentences |
| min_education_level | enum | yes | Same values as `education_stages.level` |
| typical_education_stage_ids | ids | no | `EDU_BTECH_CSE\|EDU_MTECH_CSE` |
| riasec_codes | string | yes | Interest match, e.g. `I\|C` (R, I, A, S, E, C) |
| key_aptitudes | string | yes | `logical\|numerical\|verbal\|spatial\|problem_solving` |
| personality_fit | string | no | `research\|team\|leadership\|creative\|risk_tolerant` |
| work_style | string | no | `office\|field\|lab\|remote_friendly` |
| salary_note | text | no | Indicative range + source, never a guarantee |
| onet_code | string | no | O*NET-SOC code for traceability |
| esco_uri | string | no | ESCO occupation URI |
| source_url | url | yes | |
| last_verified | date | yes | |

### 4.3 skills.csv

| Field | Type | Required | Description |
|---|---|---|---|
| skill_id | string | yes | `SKL_001` |
| skill_name | string | yes | "Python" |
| category | enum | yes | `programming`, `technical`, `math`, `soft`, `management`, `domain` |
| sub_category | string | no | "Data", "Web" |
| aliases | string | no | Alternate names for matching user input: `py\|python3` |
| description | text | no | |

### 4.4 skill_career_mapping.csv

| Field | Type | Required | Description |
|---|---|---|---|
| career_id | id | yes | FK → careers |
| skill_id | id | yes | FK → skills |
| importance | int 1–5 | yes | 5 = essential |
| proficiency_required | enum | yes | `beginner`, `intermediate`, `advanced` |
| is_mandatory | bool | yes | Missing mandatory skills weigh more in gap analysis |
| source | string | no | "O*NET", "job postings sample", etc. |

### 4.5 education_paths.csv (edges from education stages)

| Field | Type | Required | Description |
|---|---|---|---|
| path_id | string | yes | `EP_001` |
| from_stage_id | id | yes | FK → education_stages |
| to_type | enum | yes | `education`, `career`, `exam` |
| to_id | id | yes | FK → stage / career / exam depending on `to_type` |
| required_exam_ids | ids | no | `EXM_GATE` |
| eligibility_summary | text | yes | Short summary; full rules stay on the official site |
| duration_years | number | no | |
| advantages | text | no | |
| limitations | text | no | |
| verified | bool | yes | |
| source_url | url | yes | |
| last_verified | date | yes | |

### 4.6 career_paths.csv (progression within a field)

| Field | Type | Required | Description |
|---|---|---|---|
| path_id | string | yes | `CP_001` |
| from_career_id | id | yes | |
| to_career_id | id | yes | |
| transition_type | enum | yes | `promotion`, `specialization`, `lateral`, `management` |
| typical_years_experience | string | no | "2-4" |
| required_skill_ids | ids | no | Additional skills needed |
| notes | text | no | |

### 4.7 career_transition_paths.csv (switches: "I am X, can I become Y?")

| Field | Type | Required | Description |
|---|---|---|---|
| transition_id | string | yes | `TR_001` |
| from_type | enum | yes | `education` or `career` |
| from_id | id | yes | FK → stage or career |
| to_career_id | id | yes | FK → careers |
| difficulty | enum | yes | `low`, `medium`, `high` |
| estimated_months_min | int | no | |
| estimated_months_max | int | no | |
| required_skill_ids | ids | no | |
| required_qualifications | text | no | e.g. "Degree in any discipline" |
| recommended_course_ids | ids | no | |
| recommended_certification_ids | ids | no | |
| steps | text | yes | Ordered, pipe-separated: `Learn SQL\|Learn statistics\|Build 2 projects` |
| notes | text | no | |
| source_url | url | no | |

### 4.8 career_roadmaps.csv (one row per stage)

Not used today: roadmaps are generated from the skill mapping, education paths and courses
(`engine/roadmap.py`), so they stay consistent when a career's skills change. The file is kept with
its header in case hand-written stages are wanted later; only the header is validated.

| Field | Type | Required | Description |
|---|---|---|---|
| roadmap_id | string | yes | `RM_001` |
| career_id | id | yes | |
| stage_order | int | yes | 1, 2, 3 … |
| stage_name | string | yes | "Python fundamentals" |
| skill_ids | ids | yes | Skills covered; lets the generator skip known ones |
| description | text | no | |
| estimated_weeks | int | no | |
| course_ids | ids | no | |
| milestone | text | no | "Build 2 ML projects" |

### 4.9 courses.csv

| Field | Type | Required | Description |
|---|---|---|---|
| course_id | string | yes | `CRS_001` |
| course_name | string | yes | |
| provider | string | yes | "NPTEL", "IIT Madras" |
| platform | string | no | "SWAYAM", "Coursera" |
| url | url | yes | |
| skill_ids | ids | yes | Courses are listed under these skills on roadmaps (best 2 per skill: nearest level, then free first) |
| level | enum | yes | `beginner`, `intermediate`, `advanced` |
| cost_type | enum | yes | `free`, `freemium` (free to learn, paid certificate or extras), `paid` |
| duration_hours | number | no | Left empty unless the provider states it |
| language | string | yes | |
| certificate_available | bool | no | Empty = not known |
| last_verified | date | yes | |

### 4.10 certifications.csv

| Field | Type | Required | Description |
|---|---|---|---|
| certification_id | string | yes | `CRT_001` |
| certification_name | string | yes | |
| issuing_body | string | yes | "AWS", "Google", "Microsoft" |
| url | url | yes | Official page |
| related_career_ids | ids | yes | Shown in the "Get in" step of these careers' roadmaps (up to 3, entry level first) |
| skill_ids | ids | yes | |
| level | enum | yes | `foundation`, `associate`, `professional` |
| prerequisites | text | no | |
| cost_note | text | yes | No fee amounts; point to the official page |
| validity_years | int (1–10) | no | |
| last_verified | date | yes | |

### 4.11 entrance_exams.csv

| Field | Type | Required | Description |
|---|---|---|---|
| exam_id | string | yes | `EXM_GATE` |
| exam_name | string | yes | "GATE" |
| full_name | string | yes | |
| conducting_body | string | yes | "NTA", organising IIT, etc. |
| exam_level | enum | yes | `ug_admission`, `pg_admission`, `doctoral`, `government_job`, `other` |
| purpose | text | yes | What it is used for |
| eligible_stage_ids | ids | yes | Stages that can typically apply |
| eligibility_summary | text | yes | Summary only; link official notice |
| age_limit_note | text | no | |
| frequency | string | no | "Yearly" |
| typical_month | string | no | Indicative only |
| official_url | url | yes | |
| verified | bool | yes | |
| last_verified | date | yes | Re-check every exam cycle |

### 4.12 universities.csv

| Field | Type | Required | Description |
|---|---|---|---|
| university_id | string | yes | `UNI_001` |
| university_name | string | yes | |
| type | enum | yes | `central`, `state`, `deemed`, `private`, `institute_of_national_importance` |
| state | string | yes | |
| city | string | no | |
| ugc_recognized | bool | no | |
| nirf_rank | int | no | |
| nirf_category | string | no | "University", "Engineering" |
| nirf_year | int | no | |
| aishe_code | string | no | |
| official_url | url | yes | |
| last_verified | date | yes | |

### 4.13 colleges.csv

| Field | Type | Required | Description |
|---|---|---|---|
| college_id | string | yes | `COL_001` |
| college_name | string | yes | |
| university_id | id | no | FK → universities (affiliating) |
| type | enum | yes | `government`, `private`, `aided`, `autonomous` |
| state | string | yes | |
| city | string | yes | |
| stage_ids_offered | ids | yes | Courses offered, as education stages |
| accepted_exam_ids | ids | no | |
| approvals | string | no | `AICTE\|UGC` |
| nirf_rank | int | no | |
| nirf_year | int | no | |
| fees_note | text | no | Indicative, with year |
| aishe_code | string | no | |
| official_url | url | yes | |
| last_verified | date | yes | |

### 4.14 scholarships.csv

| Field | Type | Required | Description |
|---|---|---|---|
| scholarship_id | string | yes | `SCH_001` |
| scholarship_name | string | yes | |
| provider | string | yes | Ministry / state / organisation |
| provider_type | enum | yes | `central_govt`, `state_govt`, `private`, `university` |
| eligible_stage_ids | ids | yes | |
| eligibility_summary | text | yes | Summary; link official guidelines |
| income_limit_note | text | no | |
| category_note | text | no | |
| gender_note | text | no | |
| state_restriction | string | no | |
| amount_note | text | no | |
| application_window_note | text | no | |
| official_url | url | yes | Prefer scholarships.gov.in / state portals |
| verified | bool | yes | |
| last_verified | date | yes | |

### 4.15 interest_questions.csv (RIASEC)

| Field | Type | Required | Description |
|---|---|---|---|
| question_id | string | yes | `IQ_001` |
| question_text | text | yes | "Build or repair machines" |
| riasec_type | enum | yes | `R`, `I`, `A`, `S`, `E`, `C` |
| response_scale | string | yes | `1-5` (dislike → like) |
| source | string | yes | e.g. "O*NET Interest Profiler" |
| license | string | yes | Check terms before use |

### 4.16 personality_questions.csv

| Field | Type | Required | Description |
|---|---|---|---|
| question_id | string | yes | `PQ_001` |
| question_text | text | yes | |
| trait | enum | yes | `openness`, `conscientiousness`, `extraversion`, `agreeableness`, `emotional_stability`, or work-style traits (`leadership`, `risk_tolerance`, `research_orientation`, `team_orientation`, `creativity`) |
| keyed | enum | yes | `+` or `-` (reverse-scored) |
| response_scale | string | yes | `1-5` |
| source | string | yes | e.g. "IPIP" |
| license | string | yes | |

### 4.17 aptitude_questions.csv

| Field | Type | Required | Description |
|---|---|---|---|
| question_id | string | yes | `AQ_001` |
| category | enum | yes | `logical`, `numerical`, `verbal`, `spatial`, `problem_solving` |
| difficulty | enum | yes | `easy`, `medium`, `hard` |
| question_text | text | yes | |
| option_a … option_d | text | yes | |
| correct_option | enum | yes | `a`, `b`, `c`, `d` |
| explanation | text | no | |
| source | string | yes | "self-written" or licensed source |
| license | string | yes | |

---

## 5. Data Sources

| Data | Primary sources |
|---|---|
| Careers, skills, occupation mapping | O*NET database (CC BY 4.0, attribution required), ESCO (EU), National Career Service portal (ncs.gov.in) |
| Education paths / eligibility | UGC, AICTE, official university websites |
| Entrance exams | Official exam sites only (NTA, GATE organising IIT, IIMs for CAT, NLU Consortium for CLAT, UPSC, SSC) |
| Colleges / universities | AISHE (aishe.gov.in), AICTE, NIRF (nirfindia.org), data.gov.in |
| Scholarships | National Scholarship Portal (scholarships.gov.in), state portals |
| Courses | SWAYAM, NPTEL, official provider pages |
| Certifications | Official vendor certification pages |
| Interest items | O*NET Interest Profiler (RIASEC) |
| Personality items | IPIP (public domain) |
| Aptitude items | Self-written or openly licensed |

Do not scrape sites whose terms forbid it. Check each dataset's license before use.

---

## 6. MVP Targets and Fill Order

Fill in this order – each file depends on the previous ones.

| Order | File | MVP target rows |
|---|---|---|
| 1 | education_stages.csv | ~15 (Class 10 → working professional, tech focus) |
| 2 | skills.csv | ~150 |
| 3 | careers.csv | ~25–30 |
| 4 | skill_career_mapping.csv | ~8–12 skills per career |
| 5 | entrance_exams.csv | ~10 |
| 6 | education_paths.csv | ~40 edges |
| 7 | career_paths.csv | ~30 edges |
| 8 | career_transition_paths.csv | ~20 |
| 9 | career_roadmaps.csv | 5–8 stages per career |
| 10 | courses.csv / certifications.csv | ~60 / ~20 |
| 11 | interest / personality / aptitude questions | ~30 / ~30 / ~40 |
| 12 | universities.csv / colleges.csv / scholarships.csv | ~50 / ~100 / ~20 |

---

## 7. Validation Checklist (automated in Phase 3 seed script)

- Every ID is unique within its file.
- Every foreign-key ID exists in its target file.
- Enum fields contain only allowed values.
- `importance` is 1–5; `stage_order` is continuous per career.
- Time-sensitive rows have `source_url` and `last_verified`.
- No career is unreachable from every education stage (graph connectivity check).
