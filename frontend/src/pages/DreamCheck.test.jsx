import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { mockApi, renderApp } from "../test/utils";

const RESULT = {
  from: { stage: { stage_id: "EDU_12_PCM", name: "Class 12 – Science (PCM)" }, career: null },
  target: { career_id: "CAR_DATA_SCIENTIST", name: "Data Scientist", domain: "Technology", description: "", min_education_level: "ug" },
  verdict: "achievable",
  reasons: ["A known route exists with 1 study step (about 4 years)."],
  blockers: ["B.Tech – Computer Science usually needs JEE Main. Check the official eligibility."],
  time: { months_min: 48, months_max: 48, skill_weeks: 40 },
  education_route: [
    { type: "education", id: "EDU_BTECH_CSE", title: "B.Tech – Computer Science", years: 4, eligibility: "Class 12 with PCM",
      exams: [{ exam_id: "EXM_JEE_MAIN", name: "JEE Main", official_url: "https://jeemain.nta.nic.in/" }] },
    { type: "career", id: "CAR_DATA_SCIENTIST", title: "Data Scientist", years: null, eligibility: "Degree plus ML", exams: [] },
  ],
  switch: null, career_chain: null,
  skills: { readiness: 0, core_ready: 0, core_total: 8, learn_first: ["Machine learning"] },
  alternatives: [], source: "query", personalised: false,
};

describe("Dream career checker", () => {
  beforeEach(() => {
    mockApi();
    vi.spyOn(api, "getStages").mockResolvedValue([{ stage_id: "EDU_12_PCM", name: "Class 12 – Science (PCM)", level: "school" }]);
    vi.spyOn(api, "getCareers").mockResolvedValue({ total: 1, domains: [], items: [
      { career_id: "CAR_DATA_SCIENTIST", name: "Data Scientist" }, { career_id: "CAR_ACCOUNTANT", name: "Accountant" }] });
    vi.spyOn(api, "checkTransition").mockResolvedValue(RESULT);
  });

  it("checks a dream career from the form", async () => {
    renderApp("/dream-check");
    await userEvent.selectOptions(await screen.findByLabelText("Current stage"), "EDU_12_PCM");
    await userEvent.selectOptions(screen.getByLabelText("Can I become"), "CAR_DATA_SCIENTIST");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByRole("heading", { name: "Yes – with a clear plan" })).toBeInTheDocument();
    expect(api.checkTransition).toHaveBeenLastCalledWith({ to: "CAR_DATA_SCIENTIST", from_stage: "EDU_12_PCM" }, expect.anything());
    expect(screen.getByText("4 years")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /JEE Main/ })).toHaveAttribute("href", "https://jeemain.nta.nic.in/");
    expect(screen.getByText(/usually needs JEE Main/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Full skill gap" })).toHaveAttribute("href", "/skill-gap?career=CAR_DATA_SCIENTIST");
  });

  it("can start from a current career", async () => {
    renderApp("/dream-check");
    await userEvent.click(await screen.findByLabelText("Working as"));
    await userEvent.selectOptions(screen.getByLabelText("Current career"), "CAR_ACCOUNTANT");
    await userEvent.selectOptions(screen.getByLabelText("Can I become"), "CAR_DATA_SCIENTIST");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(api.checkTransition).toHaveBeenLastCalledWith({ to: "CAR_DATA_SCIENTIST", from_career: "CAR_ACCOUNTANT" }, expect.anything());
  });

  it("shows hard verdicts with alternatives", async () => {
    api.checkTransition.mockResolvedValue({ ...RESULT, verdict: "hard", education_route: null, blockers: [],
      alternatives: [{ career_id: "CAR_ACCOUNTANT", name: "Accountant", why: "Directly reachable from your stage" }] });
    renderApp("/dream-check?to=CAR_DATA_SCIENTIST&from_stage=EDU_12_PCM");
    expect(await screen.findByRole("heading", { name: "Possible, but hard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Accountant" })).toHaveAttribute("href", "/careers/CAR_ACCOUNTANT");
  });
});
