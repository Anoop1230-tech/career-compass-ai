import { describe, expect, it } from "vitest";
import { OPTIONS } from "../test/utils";
import { emptyProject, emptySkill, stepForField, toFormState, toPayload, validateStep } from "./profileForm";

const base = () => ({ ...toFormState(null), full_name: " Asha ", current_stage: "ug_student" });

describe("toFormState / toPayload", () => {
  it("round-trips an API profile without losing data", () => {
    const apiProfile = {
      full_name: "Asha",
      age: 21,
      location: "Pune",
      current_stage: "ug_student",
      bio: null,
      education: { degree: "B.Tech", branch: "CSE", institution: "X", year_of_study: 3, graduation_year: 2028, score_type: "cgpa_10", score: 8.4 },
      skills: [{ name: "Python", category: "programming", level: "advanced" }],
      certifications: [{ name: "NPTEL", issuer: null, year: 2025 }],
      experience: {
        total_years: null, current_role: null, internships: [], jobs: [],
        projects: [{ title: "App", description: null, technologies: ["React", "FastAPI"], link: "https://github.com/x/y" }],
      },
      interests: ["technology"],
      goals: ["job"],
      preferences: { work_mode: "remote", preferred_locations: ["Pune", "Remote"], open_to_relocation: false, leadership: 4 },
    };
    const payload = toPayload(toFormState(apiProfile), OPTIONS);
    expect(payload.education).toMatchObject(apiProfile.education);
    expect(payload.skills).toEqual(apiProfile.skills);
    expect(payload.experience.projects[0].technologies).toEqual(["React", "FastAPI"]);
    expect(payload.preferences).toMatchObject({ work_mode: "remote", preferred_locations: ["Pune", "Remote"], open_to_relocation: false, leadership: 4, creativity: null });
  });

  it("trims text, turns empty strings into null and numbers into numbers", () => {
    const form = base();
    form.age = " 20 ";
    form.education.score_type = "percentage";
    form.education.score = "88.5";
    const payload = toPayload(form, OPTIONS);
    expect(payload.full_name).toBe("Asha");
    expect(payload.age).toBe(20);
    expect(payload.location).toBeNull();
    expect(payload.education.score).toBe(88.5);
  });

  it("drops blank rows instead of sending invalid items", () => {
    const form = base();
    form.skills = [emptySkill(), { ...emptySkill(), name: " SQL " }];
    form.experience.projects = [emptyProject()];
    const payload = toPayload(form, OPTIONS);
    expect(payload.skills).toEqual([{ name: "SQL", category: "other", level: "beginner" }]);
    expect(payload.experience.projects).toEqual([]);
  });

  it("school stages send stream, not degree fields", () => {
    const form = { ...base(), current_stage: "class_10" };
    form.education.degree = "B.Tech"; // left over from a previous stage choice
    form.education.stream = "pcm";
    const payload = toPayload(form, OPTIONS);
    expect(payload.education.stream).toBe("pcm");
    expect(payload.education).not.toHaveProperty("degree");
  });

  it("job fields are only sent for work stages", () => {
    const form = base();
    form.experience.current_role = "Developer";
    expect(toPayload(form, OPTIONS).experience.current_role).toBeNull();
    expect(toPayload({ ...form, current_stage: "working_professional" }, OPTIONS).experience.current_role).toBe("Developer");
  });
});

describe("validateStep", () => {
  it("requires name and stage", () => {
    const form = { ...toFormState(null) };
    expect(validateStep("basic", form)).toEqual({
      full_name: expect.any(String),
      current_stage: expect.any(String),
    });
  });

  it("rejects bad ages", () => {
    for (const age of ["5", "abc", "101", "20.5"]) {
      expect(validateStep("basic", { ...base(), age })).toHaveProperty("age");
    }
    expect(validateStep("basic", { ...base(), age: "18" })).toEqual({});
  });

  it("checks score against its type", () => {
    const form = base();
    form.education.score = "9.5";
    expect(validateStep("education", form)).toHaveProperty(["education.score_type"]);
    form.education.score_type = "cgpa_10";
    expect(validateStep("education", form)).toEqual({});
    form.education.score = "11";
    expect(validateStep("education", form)).toHaveProperty(["education.score"]);
  });

  it("checks project links", () => {
    const form = base();
    form.experience.projects = [{ ...emptyProject(), title: "X", link: "github.com" }];
    expect(validateStep("experience", form)).toHaveProperty(["experience.projects.0.link"]);
  });
});

it("maps server error fields to the right step", () => {
  expect(stepForField("full_name")).toBe(0);
  expect(stepForField("education.score")).toBe(1);
  expect(stepForField("skills.0.name")).toBe(2);
  expect(stepForField("experience.projects.1.link")).toBe(3);
  expect(stepForField("goals")).toBe(4);
  expect(stepForField("preferences.leadership")).toBe(5);
  expect(stepForField("something_else")).toBe(0);
});
