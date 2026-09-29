import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { httpError, mockApi, renderApp } from "../test/utils";

const LIST = {
  total: 2,
  domains: ["Government", "Technology"],
  items: [
    { career_id: "CAR_DATA_SCIENTIST", name: "Data Scientist", domain: "Technology", sub_domain: "Data",
      description: "Uses statistics and machine learning.", min_education_level: "ug" },
    { career_id: "CAR_CIVIL_SERVICES", name: "Civil Services Officer", domain: "Government", sub_domain: null,
      description: "Administrative roles.", min_education_level: "ug" },
  ],
};

const DETAIL = {
  career_id: "CAR_DATA_SCIENTIST", name: "Data Scientist", domain: "Technology", sub_domain: "Data",
  description: "Uses statistics and machine learning.", min_education_level: "ug",
  typical_stages: [], riasec_codes: ["I", "C"], key_aptitudes: ["numerical"], personality_fit: [],
  work_style: ["remote_friendly"], salary_note: null, onet_code: "15-2051.00",
  source_url: "https://www.onetonline.org/link/summary/15-2051.00", last_verified: "2026-09-28",
  skills: [
    { skill_id: "SKL_PYTHON", name: "Python", category: "programming", importance: 5, proficiency_required: "advanced", is_mandatory: true },
    { skill_id: "SKL_DATA_VIZ", name: "Data visualization", category: "technical", importance: 3, proficiency_required: "intermediate", is_mandatory: false },
  ],
  entry_paths: [{
    path_id: "EP_018", from_stage_id: "EDU_BTECH_CSE", from_stage_name: "B.Tech – Computer Science",
    required_exams: [{ exam_id: "EXM_GATE", name: "GATE", full_name: "GATE", official_url: "https://gate2027.iitm.ac.in/", verified: false }],
    eligibility_summary: "Degree plus statistics", advantages: "Strong demand", limitations: "Needs projects",
    verified: false, source_url: null,
  }],
  next_careers: [{ career_id: "CAR_ML_ENGINEER", name: "Machine Learning Engineer", transition_type: "specialization", typical_years_experience: "2-4", notes: null }],
  previous_careers: [],
  transitions_in: [{
    transition_id: "TR_001", from_type: "education", from_id: "EDU_BTECH_CSE", from_name: "B.Tech – Computer Science",
    difficulty: "medium", estimated_months_min: 6, estimated_months_max: 12, required_skills: ["SQL"],
    required_qualifications: null, steps: ["Learn SQL", "Build projects"], notes: null,
  }],
};

describe("Careers directory", () => {
  beforeEach(() => {
    mockApi();
    vi.spyOn(api, "getStages").mockResolvedValue([{ stage_id: "EDU_BCOM", name: "B.Com", level: "ug" }]);
    vi.spyOn(api, "getCareers").mockResolvedValue(LIST);
  });

  it("lists careers grouped by field, in a fixed field order, with a result count", async () => {
    renderApp("/careers");
    expect(await screen.findByRole("heading", { name: "Data Scientist" })).toBeInTheDocument();
    expect(screen.getByText("2 careers found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Data Scientist/ })).toHaveAttribute("href", "/careers/CAR_DATA_SCIENTIST");
    // Technology comes before Government even though the API lists fields alphabetically
    const fields = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(fields).toEqual(["Technology 1", "Government 1"]);
    const gov = screen.getByRole("region", { name: /Government/ });
    expect(within(gov).getByRole("heading", { level: 3, name: "Civil Services Officer" })).toBeInTheDocument();
    expect(within(gov).queryByText("Data Scientist")).not.toBeInTheDocument();
    const jump = screen.getByRole("navigation", { name: "Jump to a category" });
    expect(within(jump).getByRole("link", { name: /Government/ })).toHaveAttribute("href", "#field-government");
  });

  it("filters come from the URL and are sent to the API", async () => {
    renderApp("/careers?q=data&domain=Technology&page=2");
    await screen.findByRole("heading", { name: "Data Scientist" });
    expect(api.getCareers).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "data", domain: "Technology", limit: 100, offset: 0 }),
      expect.anything(),
    );
    expect(screen.getByLabelText("Search")).toHaveValue("data");
  });

  it("typing searches after a short pause", async () => {
    const user = userEvent.setup();
    renderApp("/careers");
    await screen.findByRole("heading", { name: "Data Scientist" });
    await user.type(screen.getByLabelText("Search"), "secu");
    await waitFor(() =>
      expect(api.getCareers).toHaveBeenLastCalledWith(expect.objectContaining({ q: "secu", offset: 0 }), expect.anything()),
    );
    await user.selectOptions(screen.getByLabelText("Field"), "Government");
    await waitFor(() =>
      expect(api.getCareers).toHaveBeenLastCalledWith(expect.objectContaining({ domain: "Government" }), expect.anything()),
    );
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByLabelText("Search")).toHaveValue("");
  });

  it("shows a helpful message when nothing matches", async () => {
    api.getCareers.mockResolvedValue({ total: 0, items: [], domains: [] });
    renderApp("/careers?q=astronaut");
    expect(await screen.findByText(/No careers match/)).toBeInTheDocument();
  });

  it("shows an error with retry", async () => {
    api.getCareers.mockRejectedValueOnce(httpError(503, { detail: "The database is unavailable." }));
    const user = userEvent.setup();
    renderApp("/careers");
    expect(await screen.findByRole("alert")).toHaveTextContent("The database is unavailable.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Data Scientist" })).toBeInTheDocument();
  });

  it("works even if the stage list fails to load", async () => {
    api.getStages.mockRejectedValue(new Error("down"));
    renderApp("/careers");
    expect(await screen.findByRole("heading", { name: "Data Scientist" })).toBeInTheDocument();
  });
});

describe("Career detail", () => {
  beforeEach(() => {
    mockApi();
    vi.spyOn(api, "getCareer").mockResolvedValue(DETAIL);
  });

  it("shows skills, entry paths with exam links, next roles and switches", async () => {
    renderApp("/careers/CAR_DATA_SCIENTIST");
    expect(await screen.findByRole("heading", { level: 1, name: "Data Scientist" })).toBeInTheDocument();

    const skills = screen.getByRole("heading", { name: "Skills you need" }).closest("section");
    expect(within(skills).getByText("Python")).toBeInTheDocument();
    expect(within(skills).getByText("Data visualization")).toBeInTheDocument();

    const gate = screen.getByRole("link", { name: /GATE/ });
    expect(gate).toHaveAttribute("href", "https://gate2027.iitm.ac.in/");
    expect(gate).toHaveAttribute("rel", "noopener noreferrer");

    expect(screen.getByRole("link", { name: "Machine Learning Engineer" })).toHaveAttribute("href", "/careers/CAR_ML_ENGINEER");
    expect(screen.getByText("No common previous roles recorded yet.")).toBeInTheDocument();
    expect(screen.getByText("Learn SQL")).toBeInTheDocument();
    expect(screen.getByText(/about 6–12 months/)).toBeInTheDocument();
    expect(screen.getByText(/always confirm on the/)).toBeInTheDocument();
  });

  it("shows a not-found page for unknown careers", async () => {
    api.getCareer.mockRejectedValue(httpError(404, { detail: "Career not found." }));
    renderApp("/careers/CAR_NOPE");
    expect(await screen.findByRole("heading", { name: "Career not found" })).toBeInTheDocument();
  });

  it("shows a retry screen on server errors", async () => {
    api.getCareer.mockRejectedValueOnce(httpError(503, { detail: "The database is unavailable." }));
    const user = userEvent.setup();
    renderApp("/careers/CAR_DATA_SCIENTIST");
    expect(await screen.findByRole("alert")).toHaveTextContent("The database is unavailable.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Data Scientist" })).toBeInTheDocument();
  });
});
