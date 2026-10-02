import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { mockApi, renderApp } from "../test/utils";

const REPORT = {
  generated_on: "2026-10-03", email: "asha@example.com",
  profile: { name: "Asha Verma", stage: "B.Tech – Computer Science", education: "B.Tech · Computer Science",
    skills: ["Python", "SQL"], interests: ["technology"], goals: ["job"] },
  tests: { interest: { top_codes: ["I", "R", "C"], scores: {} }, aptitude: { logical: 80, numerical: 60 } },
  confidence: { percent: 72, level: "high" },
  matches: [{ career_id: "CAR_DATA_SCIENTIST", name: "Data Scientist", domain: "Technology", score: 78.4,
    strengths: ["Your skills cover most of the core list"], concerns: ["Statistics needs work"] }],
  next_steps: [{ title: "M.Tech – Computer Science", kind: "education", next_action: "Prepare for GATE", reasons: [] }],
  roadmap: { is_target: true, career: { career_id: "CAR_DATA_SCIENTIST", name: "Data Scientist" },
    progress: { done: 2, total: 6 }, projects_progress: { done: 0, total: 2 }, total_weeks: 30, study_years: 0, hours_per_week: 8,
    stages: [{ key: "core", title: "Core skills", weeks: 20, items: ["Statistics", "Machine learning"] }] },
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
    expect(document.title).toContain("Asha Verma");

    await userEvent.click(screen.getByRole("button", { name: "Print or save as PDF" }));
    expect(print).toHaveBeenCalled();
  });

  it("asks for a profile when there is none", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getReport").mockResolvedValue({ ...REPORT, profile: null, tests: {}, matches: [], next_steps: [], roadmap: null, confidence: null });
    renderApp("/report");
    expect(await screen.findByText("Your report fills in once you have a profile.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Top career matches" })).not.toBeInTheDocument();
  });

  it("is only for logged-in users", async () => {
    mockApi();
    renderApp("/report");
    expect(await screen.findByRole("heading", { level: 1, name: "Log in" })).toBeInTheDocument();
  });
});
