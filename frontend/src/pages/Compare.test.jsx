import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { mockApi, renderApp } from "../test/utils";

const career = (over) => ({
  career_id: "CAR_DATA_SCIENTIST", name: "Data Scientist", domain: "Technology", sub_domain: "Data", description: "",
  min_education_level: "ug", work_style: ["office"], riasec_codes: ["I"], core_skills: ["Statistics", "Python"],
  other_skills: ["SQL"], entry_stages: [{ stage_id: "EDU_BTECH_CSE", name: "B.Tech – Computer Science" }],
  exams: [], next_careers: [{ career_id: "CAR_ML_ENGINEER", name: "ML Engineer" }],
  route: { reachable: true, years: 4, steps: [{ type: "education", id: "EDU_BTECH_CSE", title: "B.Tech – Computer Science", years: 4 },
    { type: "career", id: "CAR_DATA_SCIENTIST", title: "Data Scientist", years: null }] },
  fit: null, ...over,
});

const RESULT = {
  careers: [career(), career({
    career_id: "CAR_DOCTOR_MBBS", name: "Doctor (MBBS)", domain: "Healthcare", sub_domain: "Medicine", core_skills: ["Anatomy"],
    other_skills: [], exams: [{ exam_id: "EXM_NEET_UG", name: "NEET UG", official_url: "https://neet.nta.nic.in/" }],
    route: { reachable: false, years: null, steps: [] }, next_careers: [] })],
  shared_skills: [], stage: { stage_id: "EDU_12_PCM", name: "Class 12 – Science (PCM)" }, personalised: false,
};

describe("Compare page", () => {
  beforeEach(() => {
    mockApi();
    vi.spyOn(api, "getCareers").mockResolvedValue({ total: 3, domains: [], items: [
      { career_id: "CAR_DATA_SCIENTIST", name: "Data Scientist" }, { career_id: "CAR_DOCTOR_MBBS", name: "Doctor (MBBS)" },
      { career_id: "CAR_LAWYER", name: "Advocate (Lawyer)" }] });
    vi.spyOn(api, "getStages").mockResolvedValue([{ stage_id: "EDU_12_PCM", name: "Class 12 – Science (PCM)", level: "school" }]);
    vi.spyOn(api, "compareCareers").mockResolvedValue(RESULT);
  });

  it("asks for two careers, then shows them side by side", async () => {
    renderApp("/compare?ids=CAR_DATA_SCIENTIST");
    expect(await screen.findByText("Choose at least two careers to compare.")).toBeInTheDocument();
    expect(api.compareCareers).not.toHaveBeenCalled();

    await userEvent.selectOptions(await screen.findByLabelText("Career 2"), "CAR_DOCTOR_MBBS");
    const table = await screen.findByRole("table", { name: /Comparison of Data Scientist, Doctor \(MBBS\)/ });
    expect(api.compareCareers).toHaveBeenLastCalledWith(["CAR_DATA_SCIENTIST", "CAR_DOCTOR_MBBS"], "", expect.anything());
    expect(within(table).getByRole("columnheader", { name: "Doctor (MBBS)" })).toBeInTheDocument();
    expect(within(table).getByText("About 4 years of study")).toBeInTheDocument();
    expect(within(table).getByText("No direct route recorded")).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: /NEET UG/ })).toHaveAttribute("href", "https://neet.nta.nic.in/");
    expect(within(table).queryByText("Match for you")).not.toBeInTheDocument();
  });

  it("a career already chosen cannot be picked twice; the stage goes into the request", async () => {
    renderApp("/compare?ids=CAR_DATA_SCIENTIST,CAR_DOCTOR_MBBS");
    const third = await screen.findByLabelText(/Career 3/);
    expect(within(third).getByRole("option", { name: "Data Scientist" })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Starting from"), "EDU_12_PCM");
    expect(api.compareCareers).toHaveBeenLastCalledWith(["CAR_DATA_SCIENTIST", "CAR_DOCTOR_MBBS"], "EDU_12_PCM", expect.anything());
  });

  it("shows fit and readiness when personalised", async () => {
    api.compareCareers.mockResolvedValue({ ...RESULT, personalised: true, shared_skills: ["Communication"],
      careers: RESULT.careers.map((c, i) => ({ ...c, fit: { score: 70 - i * 30, readiness: 60 - i * 40 } })) });
    renderApp("/compare?ids=CAR_DATA_SCIENTIST,CAR_DOCTOR_MBBS");
    expect(await screen.findByRole("rowheader", { name: "Match for you" })).toBeInTheDocument();
    expect(screen.getByText("70/100")).toBeInTheDocument();
    expect(screen.getByText(/Skills these careers share: Communication/)).toBeInTheDocument();
  });
});
