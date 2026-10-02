// Converts between the API profile shape and the form's editable state.
// Form inputs hold strings; the API wants numbers, nulls and clean lists.
// Titles and labels are translation keys (i18n/*.js "profile.*").
import { translate } from "../i18n/core";

export const STEPS = [
  { id: "basic", fields: ["full_name", "age", "location", "current_stage", "bio"] },
  { id: "education", fields: ["education"] },
  { id: "skills", fields: ["skills", "certifications"] },
  { id: "experience", fields: ["experience"] },
  { id: "interests", fields: ["interests", "goals"] },
  { id: "preferences", fields: ["preferences"] },
];

// Rating labels: profile.rating.<key>, profile.rating.<key>.low, profile.rating.<key>.high
export const RATINGS = [
  { key: "risk_tolerance" },
  { key: "leadership" },
  { key: "creativity" },
  { key: "team_orientation" },
  { key: "research_orientation" },
];

const english = (key, vars) => translate("en", key, vars);

/** Which education fields apply to a stage. */
export function stageKind(stage, options) {
  if (!stage) return "none";
  if (options?.school_stages?.includes(stage)) return "school";
  return "higher";
}

export const isWorkStage = (stage, options) => Boolean(options?.work_stages?.includes(stage));

const str = (v) => (v === null || v === undefined ? "" : String(v));

export const emptySkill = () => ({ name: "", category: "other", level: "beginner" });
export const emptyCertification = () => ({ name: "", issuer: "", year: "" });
export const emptyExperienceItem = () => ({ title: "", organization: "", duration_months: "", description: "" });
export const emptyProject = () => ({ title: "", description: "", technologies: "", link: "" });

export function toFormState(profile) {
  const p = profile || {};
  const edu = p.education || {};
  const exp = p.experience || {};
  const pref = p.preferences || {};
  return {
    full_name: str(p.full_name),
    age: str(p.age),
    location: str(p.location),
    current_stage: str(p.current_stage),
    bio: str(p.bio),
    education: {
      degree: str(edu.degree),
      branch: str(edu.branch),
      stream: str(edu.stream),
      institution: str(edu.institution),
      year_of_study: str(edu.year_of_study),
      graduation_year: str(edu.graduation_year),
      score_type: str(edu.score_type),
      score: str(edu.score),
    },
    skills: (p.skills || []).map((s) => ({ name: str(s.name), category: s.category || "other", level: s.level || "beginner" })),
    certifications: (p.certifications || []).map((c) => ({ name: str(c.name), issuer: str(c.issuer), year: str(c.year) })),
    experience: {
      total_years: str(exp.total_years),
      current_role: str(exp.current_role),
      internships: (exp.internships || []).map(itemToForm),
      jobs: (exp.jobs || []).map(itemToForm),
      projects: (exp.projects || []).map((pr) => ({
        title: str(pr.title),
        description: str(pr.description),
        technologies: (pr.technologies || []).join(", "),
        link: str(pr.link),
      })),
    },
    interests: [...(p.interests || [])],
    goals: [...(p.goals || [])],
    preferences: {
      work_mode: pref.work_mode || "any",
      preferred_locations: (pref.preferred_locations || []).join(", "),
      open_to_relocation: pref.open_to_relocation ?? true,
      ...Object.fromEntries(RATINGS.map((r) => [r.key, pref[r.key] ?? null])),
    },
  };
}

function itemToForm(item) {
  return {
    title: str(item.title),
    organization: str(item.organization),
    duration_months: str(item.duration_months),
    description: str(item.description),
  };
}

// ---- form -> API
const text = (v) => {
  const t = str(v).trim();
  return t === "" ? null : t;
};
const num = (v) => {
  const t = str(v).trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : t; // leave invalid text so the API reports it
};
const splitList = (v) =>
  str(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function itemToApi(item) {
  return {
    title: item.title.trim(),
    organization: text(item.organization),
    duration_months: num(item.duration_months),
    description: text(item.description),
  };
}

/** Builds the PUT /api/profile body. Hidden (non-applicable) fields are dropped. */
export function toPayload(form, options) {
  const kind = stageKind(form.current_stage, options);
  const e = form.education;
  const education =
    kind === "school"
      ? { stream: text(e.stream), institution: text(e.institution) }
      : {
          degree: text(e.degree),
          branch: text(e.branch),
          institution: text(e.institution),
          year_of_study: num(e.year_of_study),
          graduation_year: num(e.graduation_year),
        };
  education.score_type = text(e.score_type);
  education.score = num(e.score);

  const work = isWorkStage(form.current_stage, options);
  const exp = form.experience;

  return {
    full_name: form.full_name.trim(),
    age: num(form.age),
    location: text(form.location),
    current_stage: form.current_stage,
    bio: text(form.bio),
    education,
    // Rows left completely blank are ignored instead of causing errors
    skills: form.skills.filter((s) => s.name.trim()).map((s) => ({ ...s, name: s.name.trim() })),
    certifications: form.certifications
      .filter((c) => c.name.trim())
      .map((c) => ({ name: c.name.trim(), issuer: text(c.issuer), year: num(c.year) })),
    experience: {
      total_years: work ? num(exp.total_years) : null,
      current_role: work ? text(exp.current_role) : null,
      internships: exp.internships.filter((i) => i.title.trim()).map(itemToApi),
      jobs: exp.jobs.filter((i) => i.title.trim()).map(itemToApi),
      projects: exp.projects
        .filter((p) => p.title.trim())
        .map((p) => ({
          title: p.title.trim(),
          description: text(p.description),
          technologies: splitList(p.technologies),
          link: text(p.link),
        })),
    },
    interests: form.interests,
    goals: form.goals,
    preferences: {
      work_mode: form.preferences.work_mode || "any",
      preferred_locations: splitList(form.preferences.preferred_locations),
      open_to_relocation: Boolean(form.preferences.open_to_relocation),
      ...Object.fromEntries(RATINGS.map((r) => [r.key, form.preferences[r.key] ?? null])),
    },
  };
}

/** Checks done in the browser before saving; the API checks everything again. `t` gives the message language. */
export function validateStep(stepId, form, t = english) {
  const errors = {};
  if (stepId === "basic") {
    if (form.full_name.trim().length < 2) errors.full_name = t("profile.err.name");
    if (!form.current_stage) errors.current_stage = t("profile.err.stage");
    const age = str(form.age).trim();
    if (age && (!/^\d+$/.test(age) || +age < 10 || +age > 100)) errors.age = t("profile.err.age");
  }
  if (stepId === "education") {
    const { score, score_type } = form.education;
    const s = str(score).trim();
    if (s) {
      const limits = { percentage: 100, cgpa_10: 10, cgpa_4: 4, grade: 100 };
      if (!score_type) errors["education.score_type"] = t("profile.err.scoreType");
      else if (!Number.isFinite(+s) || +s < 0 || +s > limits[score_type])
        errors["education.score"] = t("profile.err.scoreRange", { max: limits[score_type] });
    }
  }
  if (stepId === "experience") {
    form.experience.projects.forEach((p, i) => {
      if (p.link.trim() && !/^https?:\/\/\S+\.\S+/.test(p.link.trim()))
        errors[`experience.projects.${i}.link`] = t("profile.err.link");
    });
  }
  return errors;
}

/** Which step a server error field belongs to, e.g. "skills.0.name" -> 2. */
export function stepForField(field) {
  const root = str(field).split(".")[0];
  const index = STEPS.findIndex((s) => s.fields.includes(root));
  return index === -1 ? 0 : index;
}
