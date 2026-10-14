"""Optional language-model rephrasing for the mentor.

Off by default. When LLM_API_URL, LLM_API_KEY and LLM_MODEL are set (any
OpenAI-compatible chat completions endpoint), the mentor's grounded draft
answer is rewritten in a friendlier tone. The model only receives the
question, the draft and a short profile summary (no email, no password,
no tokens), and is told not to add facts. Any error or timeout falls back
to the local answer, so the mentor always works.

PRIVACY: enabling this sends the question and the profile summary to the
configured provider. Only enable it with a provider you trust and after
telling users."""
import logging
import os

import httpx

logger = logging.getLogger("career_compass.llm")

SYSTEM_PROMPT = (
    "You are a careful career mentor for students and professionals in India. Rewrite the DRAFT answer so it is "
    "warm, clear and short. Use ONLY facts contained in the DRAFT and PROFILE. Never add numbers, salaries, dates, "
    "cut-offs, eligibility rules or institutions that are not in the DRAFT. Keep any warnings to check official "
    "websites. Plain text, at most 180 words, bullet points allowed."
)


def configured() -> bool:
    return all(os.getenv(k) for k in ("LLM_API_URL", "LLM_API_KEY", "LLM_MODEL"))


async def _post(url: str, headers: dict, json: dict, timeout: float) -> httpx.Response:
    """The only network call (tests replace it). Async, so waiting for the provider
    never holds a server worker thread."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        return await client.post(url, headers=headers, json=json)


async def rephrase(question: str, draft: str, profile_summary: str, timeout: float = 15.0) -> str | None:
    """Returns the rewritten text, or None to keep the draft."""
    if not configured():
        return None
    try:
        response = await _post(
            os.environ["LLM_API_URL"],
            headers={"Authorization": f"Bearer {os.environ['LLM_API_KEY']}"},
            json={
                "model": os.environ["LLM_MODEL"],
                "temperature": 0.3,
                "max_tokens": 400,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"QUESTION: {question}\n\nPROFILE: {profile_summary}\n\nDRAFT:\n{draft}"},
                ],
            },
            timeout=timeout,
        )
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"].strip()
        return text or None
    except Exception:  # network, auth, quota, unexpected JSON: keep the grounded draft
        logger.warning("LLM rephrase failed; using the local answer.", exc_info=True)
        return None


ANSWER_PROMPT = (
    "You are a warm, practical career mentor for students and professionals in India. The user asked a question the "
    "app's own data could not answer directly. Give a helpful, honest, encouraging reply in plain language. "
    "Give general career, study and skills guidance only. Do NOT invent specific salaries, exam dates, cut-offs, "
    "eligibility rules, fees or named institutions; if those are needed, tell the user to check official websites. "
    "Do not give medical, legal or financial advice. If the question is not about careers or study, gently steer back "
    "to how you can help with careers. Plain text, at most 180 words, bullet points allowed."
)


async def answer(question: str, profile_summary: str, timeout: float = 15.0) -> str | None:
    """A free-form answer for an open question the engine could not ground.
    Returns None (keep the local fallback) when no provider is configured or on any error.
    Only the question and a short, non-identifying profile summary are sent."""
    if not configured():
        return None
    try:
        response = await _post(
            os.environ["LLM_API_URL"],
            headers={"Authorization": f"Bearer {os.environ['LLM_API_KEY']}"},
            json={
                "model": os.environ["LLM_MODEL"],
                "temperature": 0.4,
                "max_tokens": 400,
                "messages": [
                    {"role": "system", "content": ANSWER_PROMPT},
                    {"role": "user", "content": f"QUESTION: {question}\n\nPROFILE: {profile_summary}"},
                ],
            },
            timeout=timeout,
        )
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"].strip()
        return text or None
    except Exception:  # network, auth, quota, unexpected JSON: keep the local fallback
        logger.warning("LLM answer failed; using the local fallback.", exc_info=True)
        return None