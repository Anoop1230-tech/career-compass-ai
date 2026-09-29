"""Choice lists shared by the API validation and the frontend forms.
Keeping them in one place means the form and the validator never disagree."""

STAGES = [
    ("class_10", "Class 10"),
    ("class_11_12", "Class 11–12"),
    ("diploma", "Diploma"),
    ("ug_student", "Undergraduate student"),
    ("bachelors_graduate", "Bachelor's graduate"),
    ("masters_student", "Master's student"),
    ("masters_graduate", "Master's graduate"),
    ("phd_student", "PhD student"),
    ("phd_graduate", "PhD graduate"),
    ("fresh_graduate", "Fresh graduate"),
    ("working_professional", "Working professional"),
    ("experienced_professional", "Experienced professional"),
    ("career_changer", "Career changer"),
    ("job_seeker", "Job seeker"),
    ("not_studying", "Not studying right now"),
    ("entrepreneur", "Entrepreneur"),
    ("other", "Other"),
]

# Which education fields make sense for each stage (the form shows only these)
SCHOOL_STAGES = {"class_10", "class_11_12"}
WORK_STAGES = {"working_professional", "experienced_professional", "career_changer", "entrepreneur"}

STREAMS = [
    ("pcm", "Science – PCM"),
    ("pcb", "Science – PCB"),
    ("pcmb", "Science – PCMB"),
    ("commerce", "Commerce"),
    ("humanities", "Humanities / Arts"),
    ("vocational", "Vocational"),
    ("undecided", "Not decided yet"),
]

SCORE_TYPES = [
    ("percentage", "Percentage"),
    ("cgpa_10", "CGPA (out of 10)"),
    ("cgpa_4", "GPA (out of 4)"),
    ("grade", "Grade"),
]

SKILL_CATEGORIES = [
    ("programming", "Programming"),
    ("technical", "Technical"),
    ("communication", "Communication"),
    ("management", "Management"),
    ("domain", "Domain-specific"),
    ("other", "Other"),
]

SKILL_LEVELS = [
    ("beginner", "Beginner"),
    ("intermediate", "Intermediate"),
    ("advanced", "Advanced"),
]

INTERESTS = [
    ("technology", "Technology"),
    ("business", "Business"),
    ("research", "Research"),
    ("healthcare", "Healthcare"),
    ("finance", "Finance"),
    ("law", "Law"),
    ("design", "Design"),
    ("government", "Government"),
    ("education", "Education"),
    ("media", "Media & Communication"),
    ("engineering", "Engineering"),
    ("science", "Science"),
    ("arts", "Arts"),
    ("sports", "Sports"),
    ("social_work", "Social work"),
    ("agriculture", "Agriculture"),
    ("defence", "Defence"),
    ("hospitality", "Hospitality"),
    ("music", "Music & singing"),
    ("dance", "Dance"),
    ("writing", "Writing & poetry"),
    ("performing_arts", "Acting & comedy"),
    ("film", "Film, photography & video"),
    ("fashion", "Fashion & beauty"),
    ("cooking", "Cooking"),
    ("fitness", "Fitness & yoga"),
]

GOALS = [
    ("job", "Get a job"),
    ("higher_studies", "Higher studies"),
    ("government_career", "Government career"),
    ("research", "Research"),
    ("entrepreneurship", "Start a business"),
    ("career_switch", "Switch career"),
    ("higher_salary", "Higher salary"),
    ("work_life_balance", "Work-life balance"),
    ("remote_work", "Remote work"),
    ("leadership", "Leadership role"),
    ("study_abroad", "Study abroad"),
]

WORK_MODES = [
    ("any", "No preference"),
    ("office", "Office"),
    ("remote", "Remote"),
    ("hybrid", "Hybrid"),
    ("field", "Field work"),
]


def keys(options: list[tuple[str, str]]) -> set[str]:
    return {key for key, _ in options}


def as_json(options: list[tuple[str, str]]) -> list[dict]:
    return [{"value": key, "label": label} for key, label in options]
