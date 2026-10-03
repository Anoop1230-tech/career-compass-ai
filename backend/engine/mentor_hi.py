"""Hindi for the rule-based mentor (draft wording; needs review by a native speaker).

Two parts:
- understand(): Hindi questions are mapped onto the English intent words the router already knows
  ("छात्रवृत्ति" -> "scholarship", Hindi career names -> English names), so every intent works with Hindi input;
- localize(): replies with fixed wording (greeting, need-profile, fallback, career info) and all follow-up
  suggestions are given in Hindi. Data-heavy replies (next steps, roadmaps, exams, colleges...) still use the
  English templates around Hindi-or-English catalog names; that is a known limit of this phase.
"""
import re

from engine.catalog_data import Catalog
from engine.mentor import Reply

# Longest phrases first so "कौन से करियर" wins over "करियर"
KEYWORDS = sorted([
    ("नमस्ते", " hello "), ("नमस्कार", " hello "), ("मदद", " help "),
    ("आगे क्या", " what should i do next "), ("आगे मुझे क्या", " what should i do next "), ("अब क्या करूँ", " what should i do next "),
    ("कौन से करियर", " which career "), ("कौन सा करियर", " which career "), ("मेरे लिए सही", " suit "),
    ("बन सकता", " can i become "), ("बन सकती", " can i become "), ("कैसे बनूँ", " how to become "), ("कैसे बनें", " how to become "),
    ("स्किल", " skills "), ("कौशल", " skills "), ("सीखूँ", " learn "), ("सीखना", " learn "),
    ("रोडमैप", " roadmap "), ("योजना", " plan "),
    ("प्रवेश परीक्षा", " entrance exam "), ("परीक्षा", " exam "), ("एग्ज़ाम", " exam "),
    ("छात्रवृत्ति", " scholarship "), ("स्कॉलरशिप", " scholarship "),
    ("कॉलेज", " college "), ("विश्वविद्यालय", " university "),
    ("वेतन", " salary "), ("सैलरी", " salary "), ("तनख़्वाह", " salary "), ("कमाई", " earn "),
    ("तुलना", " compare "),
    ("12वीं के बाद", " after 12 "), ("10वीं के बाद", " after 10 "), ("डिग्री के बाद", " after degree "),
], key=lambda kv: -len(kv[0]))

# Everyday Hindi words for careers whose catalog name is longer or different (whole words only)
ALIASES = {"वकील": "CAR_LAWYER", "डॉक्टर": "CAR_DOCTOR_MBBS", "टीचर": "CAR_SCHOOL_TEACHER", "शिक्षक": "CAR_SCHOOL_TEACHER",
           "नर्स": "CAR_NURSE", "पायलट": "CAR_AIR_FORCE_PILOT", "अग्निवीर": "CAR_SOLDIER", "जज": "CAR_JUDGE",
           "सैनिक": "CAR_SOLDIER"}

WHOLE_WORDS = [("या", " or "), ("बनाम", " vs ")]

SUGGESTIONS = ["आगे मुझे क्या करना चाहिए?", "कौन से करियर मेरे लिए सही हैं?", "पहले कौन सी स्किल सीखूँ?",
               "मेरे लिए कौन सी छात्रवृत्ति है?"]


def understand(catalog: Catalog, message: str) -> str:
    """Rewrite Hindi words and Hindi career names into the English the router understands."""
    text = message
    names = sorted(((t, catalog.careers[eid].name) for (kind, eid, f), t in catalog.translations.items()
                    if kind == "career" and f == "name" and eid in catalog.careers), key=lambda x: -len(x[0]))
    for hindi, english in names:
        hindi_short = hindi.split("(")[0].strip()
        for variant in sorted({hindi, hindi_short}, key=len, reverse=True):
            if variant and variant in text:
                text = text.replace(variant, f" {english.split('(')[0].strip()} ")
    for hindi, cid in ALIASES.items():
        if cid in catalog.careers:
            text = re.sub(rf"(?<!\S){hindi}(?!\S)", f" {catalog.careers[cid].name.split('(')[0].strip()} ", text)
    for hindi, english in KEYWORDS:
        text = text.replace(hindi, english)
    # Short words that also occur inside other words ("या" is in "क्या"): whole words only
    for hindi, english in WHOLE_WORDS:
        text = re.sub(rf"(?<!\S){hindi}(?!\S)", english, text)
    return text


def _name(catalog: Catalog, cid: str) -> str:
    return catalog.translations.get(("career", cid, "name"), catalog.career_name(cid))


def localize(reply: Reply, catalog: Catalog, ctx) -> Reply:
    if reply.intent == "greeting":
        name = f" {ctx.name.split()[0]}" if ctx.name else ""
        reply.text = (f"नमस्ते{name}! मैं आपका करियर मेंटर हूँ। मैं आपकी प्रोफ़ाइल, टेस्ट के नतीजों और Career Compass के "
                      "डेटा से जवाब देता हूँ। आप ऐसे सवाल पूछ सकते हैं:\n- 12वीं के बाद आगे क्या करूँ?\n"
                      "- क्या मैं डेटा साइंटिस्ट बन सकता हूँ?\n- क्लाउड इंजीनियर के लिए कौन सी स्किल चाहिए?\n"
                      "- मुझे कौन सी परीक्षा देनी चाहिए?\n- डेटा एनालिस्ट और डेटा साइंटिस्ट की तुलना करें")
    elif reply.intent == "need_profile":
        reply.text = ("आपकी प्रोफ़ाइल होने पर मैं इसका बेहतर जवाब दे पाऊँगा। अपनी पढ़ाई, स्किल और लक्ष्य जोड़ें, "
                      "मैं हर जवाब में उनका इस्तेमाल करूँगा।")
        for a in reply.actions:
            if a.get("link") == "/profile/edit":
                a["label"] = "अपनी प्रोफ़ाइल बनाएँ"
    elif reply.intent == "fallback":
        reply.text = ("मैं ठीक से समझ नहीं पाया। मैं आगे के कदम, आपके लिए सही करियर, सपनों के करियर तक पहुँचने, सीखने की "
                      "स्किल, रोडमैप, परीक्षाओं, कॉलेजों और छात्रवृत्तियों में मदद कर सकता हूँ।")
    elif reply.intent == "career" and reply.career_id in catalog.careers:
        cid = reply.career_id
        c = catalog.careers[cid]
        desc = catalog.translations.get(("career", cid, "description"), c.description)
        first, _, rest = reply.text.partition("\n\n")
        reply.text = f"{_name(catalog, cid)}: {desc}।" + (f"\n\n{rest}" if rest else "")
    # Career links show Hindi names; suggestions are Hindi questions the router understands
    for a in reply.actions:
        if a.get("link", "").startswith("/careers/"):
            a["label"] = _name(catalog, a["link"].rsplit("/", 1)[-1])
    reply.suggestions = SUGGESTIONS if reply.suggestions else []
    if reply.career_id in catalog.careers and reply.suggestions:
        n = _name(catalog, reply.career_id)
        reply.suggestions = [f"क्या मैं {n} बन सकता हूँ?", f"{n} का रोडमैप", f"{n} के लिए कौन सी स्किल चाहिए?"]
    return reply
