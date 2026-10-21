import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { mockApi, renderApp } from "../test/utils";

const REPORT = {
  generated_on: "2026-10-03", email: "asha@example.com",
  profile: { name: "Asha Verma", stage: "B.Tech – Computer Science", education: "B.Tech · Computer Science",
    skills: ["Python", "SQL"], interests: ["technology"], goals: ["job"] },
  tests: { interest: { top_codes: ["I", "R", "C"], scores: { R: 55, I: 81, A: 30, S: 42, E: 20, C: 63 } }, aptitude: { logical: 80, numerical: 60 } },
  confidence: { percent: 72, level: "high" },
  matches: [{ career_id: "CAR_DATA_SCIENTIST", name: "Data Scientist", domain: "Technology", score: 78.4,
    strengths: ["Your skills cover most of the core list"], concerns: ["Statistics needs work"] }],
  next_steps: [{ title: "M.Tech – Computer Science", kind: "education", next_action: "Prepare for GATE",
    reasons: ["you want higher studies"] }],
  roadmap: { is_target: true, career: { career_id: "CAR_DATA_SCIENTIST", name: "Data Scientist" },
    progress: { done: 2, total: 6 }, projects_progress: { done: 0, total: 2 }, total_weeks: 30, study_years: 0, hours_per_week: 8,
    stages: [{ key: "core", title: "Core skills", weeks: 20, items: ["Statistics", "Machine learning"] }] },
  skill_gap: { career: { career_id: "CAR_DATA_SCIENTIST", name: "Data Scientist" }, have: 4, total: 10,
    core_ready: 2, core_total: 6, has_skills: true, more_missing: 2,
    missing: [{ skill_id: "SKL_STATISTICS", name: "Statistics", current_level: "beginner", required_level: "advanced", is_mandatory: true, weeks: 13 }] },
  action_plan: {
    month: [{ kind: "action", text: "Prepare for GATE", for: "M.Tech – Computer Science" }, { kind: "learn", skills: ["Statistics"], more: 0 }],
    quarter: [{ kind: "continue", skills: ["Statistics"] }, { kind: "project", title: "Churn model" }],
    year: [{ kind: "exam", exams: ["GATE"] }, { kind: "apply", career: "Data Scientist" }],
  },
  summary: { best_match: { name: "Data Scientist", score: 78.4 }, target: "Data Scientist", next_step: "M.Tech – Computer Science",
    main_gap: "Statistics", skills_ready: { have: 4, total: 10 } },
};

describe("Report page", () => {
  it("shows the whole report and prints with the browser", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getReport").mockResolvedValue(REPORT);
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderApp("/report");

    expect(await screen.findByRole("heading", { level: 1, name: "My career report" })).toBeInTheDocument();
    expect(screen.getByText(/For Asha Verma/)).toBeInTheDocument();
    expect(screen.getByText("Python, SQL")).toBeInTheDocument();
    expect(screen.getByText(/Strongest: Investigative/)).toBeInTheDocument();
    expect(screen.getByText("80/100")).toBeInTheDocument();
    expect(screen.getByText("78/100")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Roadmap to my target: Data Scientist" })).toBeInTheDocument();
    expect(screen.getByText(/2 of 6 skills learned · 0 of 2 projects finished/)).toBeInTheDocument();
    // The title is set in an effect, which can land just after the first render under load
    await waitFor(() => expect(document.title).toContain("Asha Verma"));

    await userEvent.click(screen.getByRole("button", { name: "Print or save as PDF" }));
    expect(print).toHaveBeenCalled();
  });

  it("shows the summary, all interest scores, skill gap, action plan and stage weeks", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getReport").mockResolvedValue(REPORT);
    renderApp("/report");

    const summary = await screen.findByRole("region", { name: "At a glance" });
    expect(within(summary).getByText("Data Scientist · 78/100")).toBeInTheDocument();
    expect(within(summary).getByText("4 of 10")).toBeInTheDocument();
    // all six interest scales, each with a bar
    expect(screen.getByText("81/100")).toBeInTheDocument();
    expect(screen.getByText("20/100")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Investigative.*81/ })).toBeInTheDocument();
    expect(screen.getByText(/Fits you because you want higher studies/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Skill gap for Data Scientist" })).toBeInTheDocument();
    expect(screen.getAllByText("You have 4 of 10 skills").length).toBeGreaterThan(0);
    expect(screen.getByText(/beginner → advanced · 13 weeks/)).toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Next 3 months" })).toBeInTheDocument();
    expect(screen.getByText("Keep going with: Statistics")).toBeInTheDocument();
    expect(screen.getByText("Build a project: Churn model")).toBeInTheDocument();
    expect(screen.getByText("Prepare for: GATE")).toBeInTheDocument();
    expect(screen.getByText("20 weeks")).toBeInTheDocument();
  });

  it("asks for a profile when there is none", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getReport").mockResolvedValue({ ...REPORT, profile: null, tests: {}, matches: [], next_steps: [], roadmap: null,
      confidence: null, skill_gap: null, action_plan: null, summary: null });
    renderApp("/report");
    expect(await screen.findByText("Your report fills in once you have a profile.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Top career matches" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "My action plan" })).not.toBeInTheDocument();
  });

  it("is only for logged-in users", async () => {
    mockApi();
    renderApp("/report");
    expect(await screen.findByRole("heading", { level: 1, name: "Log in" })).toBeInTheDocument();
  });
});
