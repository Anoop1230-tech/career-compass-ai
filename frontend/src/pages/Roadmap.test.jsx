import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { httpError, mockApi, renderApp } from "../test/utils";

const skill = (over) => ({
  kind: "skill", skill_id: "SKL_ML", name: "Machine learning", from_level: "none", to_level: "advanced",
  weeks: 16, is_mandatory: true, done: false, description: "Models", ...over,
});

const ROADMAP = {
  career: { career_id: "CAR_ML_ENGINEER", name: "Machine Learning Engineer", domain: "Technology", description: "" },
  stage: { stage_id: "EDU_BTECH_CSE", name: "B.Tech – Computer Science" },
  stages: [
    { key: "core", order: 1, title: "Core skills", summary: "Most expected", weeks: 16, items: [skill()] },
    { key: "apply", order: 2, title: "Get in", summary: "Offers", weeks: 4, items: [
      { kind: "exam", title: "Prepare for the exam", detail: "Check dates", exams: [{ exam_id: "EXM_GATE", name: "GATE", official_url: "https://gate2027.iitm.ac.in/" }] }] },
  ],
  skipped: [{ name: "Python", level: "advanced" }],
  progress: { done: 0, total: 1, percent: 0 }, total_weeks: 20, study_years: 0, hours_per_week: 8,
  personalised: true, is_target: false, logged_in: true,
};

describe("Roadmap page", () => {
  beforeEach(() => {
    vi.spyOn(api, "getCareers").mockResolvedValue({ total: 1, domains: [], items: [{ career_id: "CAR_ML_ENGINEER", name: "Machine Learning Engineer" }] });
    vi.spyOn(api, "getRecommendations").mockResolvedValue({ items: [] });
  });

  it("shows stages, skipped skills and lets you tick skills and set the target", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getRoadmap").mockResolvedValue(ROADMAP);
    vi.spyOn(api, "markRoadmapSkill").mockResolvedValue({
      ...ROADMAP, progress: { done: 1, total: 1, percent: 100 },
      stages: [{ ...ROADMAP.stages[0], items: [skill({ done: true })] }, ROADMAP.stages[1]] });
    vi.spyOn(api, "setRoadmapTarget").mockResolvedValue({ ...ROADMAP, is_target: true });
    renderApp("/roadmap?career=CAR_ML_ENGINEER");

    expect(await screen.findByRole("heading", { level: 1, name: "Roadmap: Machine Learning Engineer" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Core skills" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /GATE/ })).toHaveAttribute("href", "https://gate2027.iitm.ac.in/");
    expect(screen.getByText(/Python \(advanced\)/)).toBeInTheDocument();
    expect(screen.getByText("0 / 1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: /Machine learning/ }));
    expect(api.markRoadmapSkill).toHaveBeenCalledWith("CAR_ML_ENGINEER", "SKL_ML", true);
    expect(await screen.findByText("1 / 1")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Machine learning/ })).toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: "Set as my target" }));
    expect(await screen.findByText("Your target career")).toBeInTheDocument();
  });

  it("opens the saved target when no career is given, else offers a chooser", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getMyRoadmap").mockRejectedValue(httpError(404, { detail: "No target" }));
    vi.spyOn(api, "getRoadmap").mockResolvedValue(ROADMAP);
    renderApp("/roadmap");
    await screen.findByRole("option", { name: "Machine Learning Engineer" });
    await userEvent.selectOptions(screen.getByLabelText("Target career"), "CAR_ML_ENGINEER");
    expect(await screen.findByRole("heading", { level: 1, name: /Machine Learning Engineer/ })).toBeInTheDocument();
  });

  it("works for visitors without checkboxes", async () => {
    mockApi();
    vi.spyOn(api, "getRoadmap").mockResolvedValue({ ...ROADMAP, logged_in: false, personalised: false });
    renderApp("/roadmap?career=CAR_ML_ENGINEER");
    expect(await screen.findByRole("heading", { level: 2, name: "Core skills" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set as my target" })).not.toBeInTheDocument();
  });
});

describe("Career explorer", () => {
  it("expands nodes on demand", async () => {
    mockApi();
    vi.spyOn(api, "getStages").mockResolvedValue([{ stage_id: "EDU_CLASS_10", name: "Class 10", level: "school" }]);
    vi.spyOn(api, "getExploreRoot").mockResolvedValue({ source: "default", root: {
      type: "stage", id: "EDU_CLASS_10", title: "Class 10", subtitle: "", has_children: true, children: [
        { type: "stage", id: "EDU_12_PCM", title: "Class 12 – Science (PCM)", has_children: true, edge: { label: "Study", years: 2, exams: [] } }] } });
    vi.spyOn(api, "expandExplore").mockResolvedValue({ node: {}, children: [
      { type: "career", id: "CAR_SOFTWARE_ENGINEER", title: "Software Engineer", has_children: false, edge: { label: "Career", exams: ["JEE Main"] } }] });
    renderApp("/explore");
    const toggle = await screen.findByRole("button", { name: "Expand Class 12 – Science (PCM)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    const list = await screen.findByRole("list", { name: "Options after Class 12 – Science (PCM)" });
    expect(within(list).getByRole("link", { name: "Software Engineer" })).toHaveAttribute("href", "/careers/CAR_SOFTWARE_ENGINEER");
    expect(within(list).getByText("via JEE Main")).toBeInTheDocument();
    expect(api.expandExplore).toHaveBeenCalledWith("stage", "EDU_12_PCM");
    await userEvent.click(screen.getByRole("button", { name: "Collapse Class 12 – Science (PCM)" }));
    expect(screen.queryByRole("list", { name: "Options after Class 12 – Science (PCM)" })).not.toBeInTheDocument();
  });

  it("puts all professional courses under one heading", async () => {
    mockApi();
    vi.spyOn(api, "getStages").mockResolvedValue([{ stage_id: "EDU_BTECH_CSE", name: "B.Tech", level: "ug" }]);
    const course = (id, title, years) => ({ type: "stage", level: "course", id, title: `Professional course – ${title}`,
      has_children: true, edge: { label: "Study", years, exams: [] } });
    vi.spyOn(api, "getExploreRoot").mockResolvedValue({ source: "default", root: {
      type: "stage", id: "EDU_BTECH_CSE", title: "B.Tech", subtitle: "", has_children: true, children: [
        { type: "stage", level: "pg", id: "EDU_MBA", title: "MBA", has_children: true, edge: { label: "Study", years: 2, exams: [] } },
        course("EDU_COURSE_MUSIC", "Music", 1), course("EDU_COURSE_WRITING", "Writing", 0.5)] } });
    renderApp("/explore");
    await screen.findByRole("button", { name: "Expand MBA" });
    expect(screen.queryByText(/Music/)).not.toBeInTheDocument(); // folded away at first
    await userEvent.click(screen.getByRole("button", { name: "Expand Professional courses" }));
    const list = screen.getByRole("list", { name: "Professional courses" });
    expect(within(list).getByText("Music")).toBeInTheDocument(); // no repeated "Professional course –" prefix
    expect(within(list).getByText("1 year")).toBeInTheDocument();
    expect(within(list).getByText("6 months")).toBeInTheDocument();
  });
});
