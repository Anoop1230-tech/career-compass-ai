"""Stable codes for user-facing error messages, so the frontend can show them in the user's language.

The English sentence stays in `detail` (and in each field error's `message`) for API clients and as a
fallback; `code` (plus `params` for messages with numbers or names) is added only when the text is known.
Codes never change once released: the frontend dictionaries (frontend/src/i18n) key on them as "err.<code>".
"""
import re

MESSAGE_CODES = {
    # Auth and account
    "Incorrect email or password.": "auth.bad_login",
    "An account with this email already exists.": "auth.email_taken",
    "Please log in to continue.": "auth.login_required",
    "Your current password is incorrect.": "auth.wrong_current_password",
    "Choose a new password that is different from the current one.": "auth.same_password",
    "This reset link is invalid or has expired. Please request a new one.": "auth.bad_reset_link",
    "Too many attempts. Please wait a minute and try again.": "rate.too_many",
    "Too many failed attempts for this account. Please wait a few minutes and try again.": "rate.account_locked",
    "Too many reset requests for this email. Please wait an hour and try again.": "rate.reset",
    "Password must contain at least one letter and one number": "auth.password_weak",
    # Profile
    "You have not created a profile yet.": "profile.missing",
    "Create your profile first to get recommendations.": "profile.missing_for_recs",
    "Choose a score type for your academic score": "profile.score_type_required",
    # Catalog and guidance
    "Career not found.": "career.not_found",
    "Exam not found.": "exam.not_found",
    "Unknown stage.": "stage.unknown",
    "Not found.": "not_found",
    "You have not chosen a target career yet.": "roadmap.no_target",
    "This skill is not part of this roadmap.": "roadmap.skill_not_in_roadmap",
    "Tell us where you are now: choose a stage or a current career.": "dream.from_required",
    "Reference data is not loaded yet. Run: python -m catalog.seed": "data.not_loaded",
    # Assessments
    "Questions are not loaded yet. Please try again shortly.": "assess.not_loaded",
    "This test session was not found. Please start again.": "assess.session_missing",
    "This test was already submitted.": "assess.already_submitted",
    "This test session has expired. Please start again.": "assess.session_expired",
    "You have not taken this test yet.": "assess.not_taken",
    # Server
    "The database is unavailable. Please try again shortly.": "server.db_unavailable",
    "Something went wrong on the server.": "server.error",
}

# Messages that carry a value; named groups become `params`
PATTERNS = [
    (re.compile(r"^Score cannot be more than (?P<max>[\d.]+) for this score type$"), "profile.score_too_high"),
    (re.compile(r"^Invalid (?P<field>[\w ]+): '(?P<value>.*)'$"), "invalid_choice"),
    (re.compile(r"^Unknown stage or career: (?P<name>.*)$"), "dream.unknown_from"),
]

# Built-in validation error types (pydantic) the frontend translates; their ctx values become params
VALIDATION_TYPES = {
    "missing", "string_too_short", "string_too_long", "greater_than_equal", "less_than_equal",
    "greater_than", "less_than", "int_parsing", "float_parsing", "value_error", "too_long", "too_short",
}


def message_code(text) -> dict:
    """{"code": ..., "params": {...}} for a known English message, else {}."""
    if not isinstance(text, str):
        return {}
    if text in MESSAGE_CODES:
        return {"code": MESSAGE_CODES[text]}
    for pattern, code in PATTERNS:
        match = pattern.match(text)
        if match:
            return {"code": code, "params": match.groupdict()}
    return {}


def validation_code(error: dict, message: str) -> dict:
    """Code for one pydantic error: our own validator sentences first, then the built-in type."""
    own = message_code(message)
    if own:
        return own
    kind = error.get("type")
    if kind not in VALIDATION_TYPES or kind == "value_error":
        return {}
    ctx = error.get("ctx") or {}
    params = {k: v for k, v in ctx.items() if isinstance(v, (int, float, str))}
    return {"code": f"v.{kind}", **({"params": params} if params else {})}
