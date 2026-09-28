import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { mockApi, renderApp } from "../test/utils";

const gapItem = (over) => ({
  skill_id: "SKL_STATISTICS", name: "Statistics", category: "math", description: "Data maths", importance: 5,
  is_mandatory: true, required_level: "intermediate", current_level: "beginner", source: "profile",
  status: "partial", priority: 7.5, weeks: 5, rank: 1, ...over,
});

const GAP = {
  career: { career_id: "CAR_DATA_SCIENTIST", name: "Data Scientist", domain: "Technology" },
  readiness: 42, core_ready: 1, core_total: 4,
  learn_first: [gapItem(), gapItem({ skill_id: "SKL_ML", name: "Machine learning", status: "missing", current_level: "none", weeks: 8, rank: 2 })],
  learn_next: [gapItem({ skill_id: "SKL_DATA_VIZ", name: "Data visualization", is_mandatory: false, status: "missing", current_level: "none", rank: 3, weeks: 3, importance: 3 })],
  have: [{ skill_id: "SKL_PYTHON", name: "Python", current_level: "advanced" }],
  transferable: ["Figma"], estimate: { core_weeks: 13, all_weeks: 16, hours_per_week: 8 },
  has_skills: true, unmatched_skills: [],
};

describe("Skill gap page", () => {
  beforeEach(() => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getCareers").mockResolvedValue({ total: 2, domains: [], items: [
      { career_id: "CAR_DATA_SCIENTIST", name: "Data Scientist" }, { career_id: "CAR_ACCOUNTANT", name: "Accountant" }] });
    vi.spyOn(api, "getRecommendations").mockResolvedValue({ items: [{ career_id: "CAR_ACCOUNTANT", name: "Accountant" }] });
    vi.spyOn(api, "getSkillGap").mockResolvedValue(GAP);
  });

  it("shows readiness, prioritised gaps and what you have", async () => {
    renderApp("/skill-gap?career=CAR_DATA_SCIENTIST");
    expect(await screen.findByText("42%")).toBeInTheDocument();
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    expect(screen.getByText("13 weeks")).toBeInTheDocument();
    const first = screen.getByRole("table", { name: "Core skills to learn, in priority order" });
    expect(first).toHaveTextContent("Statistics");
    expect(first).toHaveTextContent("Improve");
    expect(screen.getAllByRole("img", { name: "Importance 5 out of 5" }).length).toBe(2);
    expect(screen.getByText("Python · advanced")).toBeInTheDocument();
    expect(screen.getByText(/Other skills you bring: Figma/)).toBeInTheDocument();
    expect(api.getSkillGap).toHaveBeenCalledWith("CAR_DATA_SCIENTIST", expect.anything());
  });

  it("suggests top matches when no career is chosen", async () => {
    renderApp("/skill-gap");
    await userEvent.click(await screen.findByRole("button", { name: "Accountant" }));
    expect(api.getSkillGap).toHaveBeenLastCalledWith("CAR_ACCOUNTANT", expect.anything());
  });

  it("switches career from the picker", async () => {
    renderApp("/skill-gap?career=CAR_DATA_SCIENTIST");
    await userEvent.selectOptions(await screen.findByLabelText("Target career"), "CAR_ACCOUNTANT");
    expect(api.getSkillGap).toHaveBeenLastCalledWith("CAR_ACCOUNTANT", expect.anything());
  });
});
