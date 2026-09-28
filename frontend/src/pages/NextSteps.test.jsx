import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { httpError, mockApi, renderApp } from "../test/utils";

const STAGES = [
  { stage_id: "EDU_12_PCM", name: "Class 12 – Science (PCM)", level: "school" },
  { stage_id: "EDU_BTECH_CSE", name: "B.Tech – Computer Science", level: "ug" },
];

const option = (over) => ({
  path_id: "EP_023", kind: "education", target_id: "EDU_MTECH_CSE", title: "M.Tech – Computer Science",
  summary: "Postgraduate degree", eligibility: "Engineering degree; GATE score", duration_years: 2,
  exams: [{ exam_id: "EXM_GATE", name: "GATE", official_url: "https://gate2027.iitm.ac.in/", typical_month: "February" }],
  advantages: "Specialization", limitations: "Two years out of work", verified: false, source_url: null,
  last_verified: "2026-09-28", next_action: "Check this year's GATE dates.", relevance: 3,
  reasons: ["you want higher studies"], opens: { careers: [{ id: "CAR_X", name: "AI Research Scientist" }], education: [] },
  ...over,
});

const RESULT = {
  context: { logged_in: true, has_profile: true, source: "profile", profile_stage_id: "EDU_BTECH_CSE",
    stage_note: "From your profile: B.Tech in computer science.", stage_exact: true, assessments_taken: [] },
  result: {
    stage: { stage_id: "EDU_BTECH_CSE", name: "B.Tech – Computer Science", level: "ug", description: "Engineering degree" },
    personalised: true,
    groups: {
      education: [option()],
      career: [option({
        path_id: "EP_018", kind: "career", target_id: "CAR_DATA_SCIENTIST", title: "Data Scientist", exams: [],
        duration_years: null, opens: undefined, reasons: [], next_action: "Start with Statistics.",
        skills: { coverage: 45, have: ["Python"], to_improve: [], missing_core: ["Statistics"] },
      })],
      exam: [],
    },
    switches: [{ transition_id: "TR_001", career_id: "CAR_DATA_SCIENTIST", title: "Data Scientist", difficulty: "medium",
      months_min: 6, months_max: 12, steps: ["Learn SQL"], skills_needed: ["SQL"], skills_missing: ["SQL"], notes: null }],
    other_exams: [],
    counts: { options: 2 },
  },
};

describe("Next steps page", () => {
  beforeEach(() => {
    vi.spyOn(api, "getStages").mockResolvedValue(STAGES);
  });

  it("shows grouped options for the profile stage with reasons and actions", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getNextSteps").mockResolvedValue(RESULT);
    renderApp("/next-steps");
    expect(await screen.findByRole("heading", { level: 2, name: "B.Tech – Computer Science" })).toBeInTheDocument();
    expect(api.getNextSteps).toHaveBeenCalledTimes(1); // waits for login status, loads once
    expect(api.getNextSteps).toHaveBeenCalledWith(undefined, expect.anything());
    expect(screen.getByText("From your profile: B.Tech in computer science.")).toBeInTheDocument();
    expect(screen.getByText(/you want higher studies/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /GATE/ })).toHaveAttribute("href", "https://gate2027.iitm.ac.in/");
    expect(screen.getByText("Check this year's GATE dates.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Skills you have for Data Scientist: 45 out of 100" })).toBeInTheDocument();
    expect(screen.getAllByText("Not yet verified").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 2, name: "Switch paths" })).toBeInTheDocument();
  });

  it("filters by group", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getNextSteps").mockResolvedValue(RESULT);
    renderApp("/next-steps");
    await screen.findByRole("heading", { level: 2, name: "Study further" });
    await userEvent.click(screen.getByRole("button", { name: /Start a career/ }));
    expect(screen.queryByRole("heading", { level: 2, name: "Study further" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Start a career" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start a career/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("asks visitors to choose a stage and loads it", async () => {
    mockApi();
    vi.spyOn(api, "getNextSteps").mockImplementation((stage) =>
      Promise.resolve(stage ? { ...RESULT, context: { ...RESULT.context, logged_in: false, source: "query" } }
        : { context: { logged_in: false, has_profile: false, source: "none" }, result: null }));
    renderApp("/next-steps");
    expect(await screen.findByText(/Choose your current stage above/)).toBeInTheDocument();
    await userEvent.selectOptions(await screen.findByLabelText("Where are you now?"), "EDU_BTECH_CSE");
    expect(await screen.findByRole("heading", { level: 2, name: "B.Tech – Computer Science" })).toBeInTheDocument();
    expect(api.getNextSteps).toHaveBeenLastCalledWith("EDU_BTECH_CSE", expect.anything());
  });

  it("shows an error with retry", async () => {
    mockApi();
    vi.spyOn(api, "getNextSteps")
      .mockRejectedValueOnce(httpError(503, { detail: "Reference data is not loaded yet." }))
      .mockResolvedValue(RESULT);
    renderApp("/next-steps?stage=EDU_BTECH_CSE");
    expect(await screen.findByText("Reference data is not loaded yet.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 2, name: "B.Tech – Computer Science" })).toBeInTheDocument();
  });
});
