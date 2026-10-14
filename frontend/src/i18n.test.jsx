import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import en from "./i18n/en";
import hi from "./i18n/hi";
import { getStoredLanguage, translate } from "./i18n/core";
import { NAV_GROUPS, NAV_ITEMS } from "./navigation";
import { mockApi, renderApp } from "./test/utils";

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("Translations", () => {
  afterEach(() => localStorage.clear());

  it("Hindi has exactly the same keys as English, with the same placeholders", () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en)) {
      expect(placeholders(hi[key]), key).toEqual(placeholders(en[key]));
      expect(hi[key].trim(), key).not.toBe("");
    }
  });

  it("every menu entry has both translations", () => {
    for (const entry of [...NAV_GROUPS, ...NAV_ITEMS]) {
      const suffix = entry.items ? "hint" : "text";
      for (const key of [`nav.${entry.key}`, `nav.${entry.key}.${suffix}`]) {
        expect(en[key], key).toBeTruthy();
        expect(hi[key], key).toBeTruthy();
      }
      expect(en[`nav.${entry.key}`]).toBe(entry.label); // English text stays the source
    }
  });

  it("fills placeholders and falls back to English, then to the key", () => {
    expect(translate("hi", "footer.tagline", { year: 2026 })).toContain("2026");
    expect(translate("xx", "nav.home")).toBe("Home");
    expect(translate("hi", "missing.key")).toBe("missing.key");
  });

  it("remembers the chosen language and ignores unknown values", () => {
    expect(getStoredLanguage()).toBe("en");
    localStorage.setItem("cc-lang", "hi");
    expect(getStoredLanguage()).toBe("hi");
    localStorage.setItem("cc-lang", "fr");
    expect(getStoredLanguage()).toBe("en");
  });

  it("switching to Hindi translates the menu, sets <html lang> and is saved", async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp("/");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Dashboard" })).toBeInTheDocument();

    await user.click(within(nav).getByRole("radio", { name: "हिन्दी" }));
    const hindiNav = screen.getByRole("navigation", { name: "मुख्य" });
    expect(within(hindiNav).getByRole("link", { name: "डैशबोर्ड" })).toBeInTheDocument();
    expect(within(hindiNav).getByRole("group", { name: "आपकी यात्रा" })).toBeInTheDocument();
    expect(await within(hindiNav).findByRole("link", { name: "लॉग इन" })).toHaveAttribute("href", "/login");
    expect(document.documentElement).toHaveAttribute("lang", "hi");
    expect(localStorage.getItem("cc-lang")).toBe("hi");

    await user.click(within(hindiNav).getByRole("radio", { name: "English" }));
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("lang", "en");
  });
});


describe("Pages in Hindi", () => {
  it("home and login pages are translated, and form checks speak Hindi", async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp("/", { lang: "hi" });
    expect(await screen.findByRole("heading", { level: 1, name: /कहाँ जाना चाहते हैं/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "जहाँ आप हैं, वहीं से शुरू करें" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /कक्षा 10/ })).toHaveAttribute("href", "/next-steps?stage=EDU_CLASS_10");

    await user.click(within(screen.getByRole("navigation", { name: "मुख्य" })).getByRole("link", { name: "लॉग इन" }));
    expect(await screen.findByRole("heading", { level: 1, name: "लॉग इन" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "लॉग इन" }));
    expect(screen.getByText("सही ईमेल पता लिखें।")).toBeInTheDocument();
    expect(screen.getByText("अपना पासवर्ड लिखें।")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "पासवर्ड भूल गए?" })).toHaveAttribute("href", "/forgot-password");
  });
});


describe("Profile and dashboard in Hindi", () => {
  it("choice-list labels exist in both languages for the same options", async () => {
    const { default: optEn } = await import("./i18n/options.en");
    const { default: optHi } = await import("./i18n/options.hi");
    expect(Object.keys(optHi).sort()).toEqual(Object.keys(optEn).sort());
    // English labels match what the server sends (test/utils OPTIONS is a copy of part of it)
    expect(optEn["opt.stages.ug_student"]).toBe("Undergraduate student");
  });

  it("profile form, choice lists and validation are in Hindi", async () => {
    mockApi({ loggedIn: true });
    const user = userEvent.setup();
    renderApp("/profile/edit", { lang: "hi" });
    expect(await screen.findByRole("heading", { level: 1, name: "अपनी प्रोफ़ाइल बनाएँ" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "आपके बारे में" })).toBeInTheDocument();
    const stage = screen.getByLabelText(/आप अभी कहाँ हैं/);
    expect(within(stage).getByRole("option", { name: "स्नातक छात्र" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "आगे बढ़ें" }));
    expect(screen.getByText("अपना नाम लिखें (कम से कम 2 अक्षर)।")).toBeInTheDocument();
  });

  it("dashboard is in Hindi", async () => {
    mockApi({ loggedIn: true });
    renderApp("/dashboard", { lang: "hi" });
    expect(await screen.findByText("अब यह करें")).toBeInTheDocument();
    expect(screen.getByText("4 में से 0 कदम पूरे")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /प्रोफ़ाइल पूरी करें/ })[0]).toHaveAttribute("href", "/profile/quick");
  });
});

describe("Assessments in Hindi", () => {
  it("test list and answer choices are in Hindi; the question text stays as sent", async () => {
    const api = await import("./services/api");
    const { vi } = await import("vitest");
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getAssessments").mockResolvedValue([
      { kind: "interest", title: "Interest profile", description: "x", minutes: 5, question_count: 3, completed_at: null, in_progress: false },
    ]);
    vi.spyOn(api, "startAssessment").mockResolvedValue({
      attempt_id: 71, kind: "interest", title: "Interest profile", scale: "like",
      questions: [{ question_id: "IQ_R01", text: "Repair a bicycle" }, { question_id: "IQ_I01", text: "Do a science experiment" }],
    });
    const user = userEvent.setup();
    renderApp("/assessments", { lang: "hi" });
    expect(await screen.findByRole("heading", { level: 2, name: "रुचि प्रोफ़ाइल" })).toBeInTheDocument();
    expect(screen.getByText("3 सवाल")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "शुरू करें" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Repair a bicycle" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "बहुत पसंद" })).toBeInTheDocument();
    expect(screen.getByText("2 में से सवाल 1 · 0 के जवाब दिए")).toBeInTheDocument();
  });
});


describe("Guidance pages in Hindi", () => {
  it("For You, Skill gap and Can I become are in Hindi", async () => {
    const api = await import("./services/api");
    const { vi } = await import("vitest");
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getRecommendations").mockResolvedValue({
      confidence: { percent: 64, level: "medium", signals: {}, improve: [] },
      weights: { interest: 22, skills: 22, education: 18, aptitude: 14, personality: 10, preferences: 14 },
      domains: [], total: 1, stage: null, unmatched_skills: [],
      items: [{ career_id: "CAR_X", name: "Data Scientist", domain: "Technology", description: "", score: 70, strengths: ["a"],
        concerns: [], skills_to_learn: [], components: [], feedback: null }],
    });
    vi.spyOn(api, "getCareers").mockResolvedValue({ total: 1, domains: [], items: [{ career_id: "CAR_X", name: "Data Scientist" }] });
    vi.spyOn(api, "getStages").mockResolvedValue([{ stage_id: "EDU_BCA", name: "BCA", level: "ug" }]);

    const first = renderApp("/for-you", { lang: "hi" });
    expect(await screen.findByRole("heading", { level: 1, name: "आपके लिए करियर" })).toBeInTheDocument();
    expect(await screen.findByText(/भरोसा: 64%/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "हाँ, सही है" })).toBeInTheDocument();
    first.unmount();

    const second = renderApp("/skill-gap", { lang: "hi" });
    expect(await screen.findByRole("heading", { level: 1, name: "कौशल की कमी" })).toBeInTheDocument();
    expect(await screen.findByLabelText("लक्ष्य करियर")).toBeInTheDocument();
    second.unmount();

    renderApp("/dream-check", { lang: "hi" });
    expect(await screen.findByRole("heading", { level: 1, name: /क्या मैं बन सकता/ })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "जाँचें" })).toBeDisabled();
  });
});

describe("Server messages", () => {
  it("are shown in the chosen language when the server sends a code", async () => {
    const { getErrorMessage, getFieldErrors } = await import("./services/api");
    const err = (status, data) => ({ response: { status, data } });
    localStorage.setItem("cc-lang", "hi");
    try {
      expect(getErrorMessage(err(401, { detail: "Incorrect email or password.", code: "auth.bad_login" })))
        .toBe("ईमेल या पासवर्ड गलत है।");
      expect(getErrorMessage(err(404, { detail: "Some new message" }))).toBe("Some new message");
      expect(getErrorMessage(err(404, { detail: "Brand new", code: "not.in.dictionary" }))).toBe("Brand new");
      expect(getFieldErrors(err(422, { detail: "x", errors: [
        { field: "password", message: "String should have at least 8 characters", code: "v.string_too_short", params: { min_length: 8 } },
      ] }))).toEqual({ password: "कम से कम 8 अक्षर होने चाहिए।" });
      expect(getErrorMessage({})).toBe("सर्वर से संपर्क नहीं हो पा रहा। क्या बैकएंड चल रहा है?");
    } finally {
      localStorage.removeItem("cc-lang");
    }
    expect(getErrorMessage(err(401, { detail: "Incorrect email or password.", code: "auth.bad_login" })))
      .toBe("Incorrect email or password.");
  });
});


describe("Explore pages in Hindi", () => {
  it("Careers, Exams & Colleges, Mentor and 404 are in Hindi", async () => {
    const api = await import("./services/api");
    const { vi } = await import("vitest");
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getStages").mockResolvedValue([]);
    vi.spyOn(api, "getCareers").mockResolvedValue({ total: 1, domains: ["Technology"], items: [
      { career_id: "CAR_X", name: "Data Scientist", domain: "Technology", sub_domain: "", description: "" }] });
    vi.spyOn(api, "getResourceFilters").mockResolvedValue({ states: [], institution_types: [], provider_types: [] });
    vi.spyOn(api, "getResources").mockResolvedValue({ total: 0, items: [], note: null, stage: null });
    vi.spyOn(api, "getMentorHistory").mockResolvedValue({ messages: [], suggestions: [], llm_enabled: false });

    let view = renderApp("/careers", { lang: "hi" });
    expect(await screen.findByText("1 करियर मिला")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /टेक्नोलॉजी/ })).toBeInTheDocument();
    view.unmount();

    view = renderApp("/resources", { lang: "hi" });
    expect(await screen.findByRole("heading", { level: 1, name: "परीक्षाएँ, कॉलेज और छात्रवृत्तियाँ" })).toBeInTheDocument();
    expect(await screen.findByText("इन फ़िल्टर से कुछ नहीं मिला। कोई एक फ़िल्टर हटाकर देखें।")).toBeInTheDocument();
    view.unmount();

    view = renderApp("/mentor", { lang: "hi" });
    expect(await screen.findByRole("button", { name: "भेजें" })).toBeInTheDocument();
    view.unmount();

    renderApp("/no-such-page", { lang: "hi" });
    expect(await screen.findByRole("heading", { level: 1, name: "पेज नहीं मिला" })).toBeInTheDocument();
  });
});
