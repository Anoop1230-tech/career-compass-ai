import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { httpError, mockApi, renderApp } from "../test/utils";

const component = (key, label, score, explanation) => ({
  key, label, weight: 20, available: score != null, score, explanation, contribution: 0,
});

const DATA = {
  confidence: { percent: 64, level: "medium", signals: {}, improve: [
    { key: "interest", text: "Take the interest test", link: "/assessments/interest" }] },
  weights: { interest: 22, skills: 22, education: 18, aptitude: 14, personality: 10, preferences: 14 },
  domains: ["Finance", "Technology"],
  total: 34,
  stage: { stage_id: "EDU_BTECH_CSE", name: "B.Tech – Computer Science", note: "" },
  unmatched_skills: ["Juggling"],
  items: [{
    career_id: "CAR_DATA_SCIENTIST", name: "Data Scientist", domain: "Technology", sub_domain: "Data",
    description: "Uses statistics.", score: 72.4, strengths: ["You already have Python"], concerns: [],
    skills_to_learn: ["Statistics"], steps_from_stage: 1,
    components: [component("skills", "Your skills", 45, "You already have Python"), component("aptitude", "Aptitude quiz", null, null)],
  }],
};

describe("Recommendations page", () => {
  it("shows ranked careers with reasons, confidence and score details", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getRecommendations").mockResolvedValue(DATA);
    renderApp("/for-you");
    expect(await screen.findByRole("heading", { name: "Data Scientist" })).toBeInTheDocument();
    expect(screen.getByLabelText("Match 72 out of 100")).toBeInTheDocument();
    expect(screen.getByText(/Confidence: 64%/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Take the interest test" })).toHaveAttribute("href", "/assessments/interest");
    expect(screen.getByText(/Juggling/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skill gap" })).toHaveAttribute("href", "/skill-gap?career=CAR_DATA_SCIENTIST");

    await userEvent.click(screen.getByRole("button", { name: "How this score was made" }));
    expect(screen.getByRole("img", { name: "Your skills for Data Scientist: 45 out of 100" })).toBeInTheDocument();
    expect(screen.getByText("not available")).toBeInTheDocument();
  });

  it("filters by area", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getRecommendations").mockResolvedValue(DATA);
    renderApp("/for-you");
    await userEvent.selectOptions(await screen.findByLabelText("Area"), "Finance");
    expect(api.getRecommendations).toHaveBeenLastCalledWith({ domain: "Finance", limit: 15 }, expect.anything());
  });

  it("asks for a profile when there is none", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getRecommendations").mockRejectedValue(httpError(404, { detail: "Create your profile first" }));
    renderApp("/for-you");
    expect(await screen.findByRole("heading", { name: "Create your profile first" })).toBeInTheDocument();
  });

  it("requires login", async () => {
    mockApi();
    renderApp("/for-you");
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });
});
