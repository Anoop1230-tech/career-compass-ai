import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { USER, httpError, mockApi, renderApp } from "../test/utils";

const PROFILE = { full_name: "Asha Verma", current_stage: "ug_student" };
const TESTS = [
  { kind: "interest", completed_at: "2026-09-28T00:00:00Z" },
  { kind: "personality", completed_at: null },
  { kind: "aptitude", completed_at: null },
];
const ROADMAP = { career: { career_id: "CAR_DATA_SCIENTIST", name: "Data Scientist" }, progress: { done: 0, total: 8, percent: 0 } };

function setup({ profile = PROFILE, tests = [], roadmap = null } = {}) {
  mockApi({ loggedIn: true, user: { ...USER, has_profile: Boolean(profile) }, profile });
  api.getAssessments.mockResolvedValue(tests);
  if (roadmap) api.getMyRoadmap.mockResolvedValue(roadmap);
  renderApp("/dashboard");
}

const nextStep = async () => screen.findByRole("region", { name: "Recommended next step" });

describe("Dashboard", () => {
  it("without a profile, the next step is building one", async () => {
    setup({ profile: null });
    expect(await screen.findByRole("heading", { level: 1, name: "Welcome" })).toBeInTheDocument();
    const next = await nextStep();
    expect(next).toHaveTextContent("Build your profile");
    expect(within(next).getByRole("link", { name: /Complete profile/ })).toHaveAttribute("href", "/profile/quick");
    expect(screen.getByText("0 of 4 steps done")).toBeInTheDocument();
  });

  it("after the profile, it suggests an assessment and greets by first name", async () => {
    setup();
    expect(await screen.findByRole("heading", { level: 1, name: "Welcome, Asha" })).toBeInTheDocument();
    expect(await nextStep()).toHaveTextContent("Take a short assessment");
    expect(screen.getByText("1 of 4 steps done")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Journey progress" })).toHaveAttribute("aria-valuenow", "25");
  });

  it("after an assessment, it points to career matches", async () => {
    setup({ tests: TESTS });
    const next = await nextStep();
    expect(next).toHaveTextContent("See careers that fit you");
    expect(within(next).getByRole("link", { name: /View my matches/ })).toHaveAttribute("href", "/for-you");
    expect(screen.getByText(/1 of 3 taken/)).toBeInTheDocument();
  });

  it("with a target career, it shows the target and suggests the roadmap", async () => {
    setup({ tests: TESTS, roadmap: ROADMAP });
    expect(await nextStep()).toHaveTextContent("Follow your roadmap");
    expect(screen.getByText(/Target: Data Scientist/)).toBeInTheDocument();
  });

  it("when every step is done, it celebrates and offers the roadmap and mentor", async () => {
    setup({ tests: TESTS, roadmap: { ...ROADMAP, progress: { done: 2, total: 8, percent: 25 } } });
    const next = await nextStep();
    expect(next).toHaveTextContent("You're on your way");
    expect(within(next).getByRole("link", { name: "Ask the mentor" })).toHaveAttribute("href", "/mentor");
    expect(screen.getByText("4 of 4 steps done")).toBeInTheDocument();
  });

  it("lists shortcuts to the explore and prepare features", async () => {
    setup();
    const side = await screen.findByRole("complementary", { name: "Explore and prepare" });
    for (const name of [/Careers/, /Career Tree/, /Can I become/, /Assessments/, /Exams & Colleges/, /Mentor/]) {
      expect(within(side).getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("shows a retry screen when loading fails, and recovers", async () => {
    mockApi({ loggedIn: true, user: { ...USER, has_profile: true }, profile: PROFILE });
    api.getAssessments.mockRejectedValueOnce(httpError(500, { detail: "Server exploded." }));
    const user = userEvent.setup();
    renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Could not load your dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Server exploded.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await nextStep()).toHaveTextContent("Take a short assessment");
  });

  it("requires login", async () => {
    mockApi();
    renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(vi.mocked(api.getAssessments)).not.toHaveBeenCalled();
  });
});
