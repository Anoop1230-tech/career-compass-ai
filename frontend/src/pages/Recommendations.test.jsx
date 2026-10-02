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

  it("saves 'does it fit you?' answers with an optional reason", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getRecommendations").mockResolvedValue({ ...DATA, items: [{ ...DATA.items[0], feedback: null }] });
    vi.spyOn(api, "saveRecommendationFeedback").mockImplementation(async (id, verdict, reason) =>
      ({ career_id: id, feedback: { verdict, reason: reason || null } }));
    vi.spyOn(api, "deleteRecommendationFeedback").mockResolvedValue();
    const user = userEvent.setup();
    renderApp("/for-you");

    const yes = await screen.findByRole("button", { name: "Yes, it fits" });
    expect(yes).toHaveAttribute("aria-pressed", "false");
    await user.click(yes);
    expect(api.saveRecommendationFeedback).toHaveBeenCalledWith("CAR_DATA_SCIENTIST", "fits", undefined);
    expect(await screen.findByText("Thanks, your answer is saved.")).toBeInTheDocument();
    expect(yes).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Not for me" }));
    await user.selectOptions(screen.getByLabelText(/Main reason/), "too_hard_to_reach");
    expect(api.saveRecommendationFeedback).toHaveBeenLastCalledWith("CAR_DATA_SCIENTIST", "not_for_me", "too_hard_to_reach");

    await user.click(screen.getByRole("button", { name: "Remove answer" }));
    expect(api.deleteRecommendationFeedback).toHaveBeenCalledWith("CAR_DATA_SCIENTIST");
    expect(screen.getByRole("button", { name: "Not for me" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows a saved answer and rolls back when saving fails", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getRecommendations").mockResolvedValue({
      ...DATA, items: [{ ...DATA.items[0], feedback: { verdict: "fits", reason: null } }] });
    vi.spyOn(api, "saveRecommendationFeedback").mockRejectedValue(httpError(503, { detail: "The database is unavailable." }));
    const user = userEvent.setup();
    renderApp("/for-you");
    expect(await screen.findByRole("button", { name: "Yes, it fits" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Not for me" }));
    expect(await screen.findByText("The database is unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, it fits" })).toHaveAttribute("aria-pressed", "true");
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
