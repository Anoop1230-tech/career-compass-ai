import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { mockApi, renderApp } from "../test/utils";

const FILTERS = {
  states: ["Delhi", "Tamil Nadu"],
  institution_types: [{ value: "central", label: "Central university" }],
  provider_types: [{ value: "private", label: "Private" }],
  exam_levels: ["pg_admission"],
};
const EXAMS = { stage: null, note: null, total: 1, items: [{
  exam_id: "EXM_GATE", name: "GATE", full_name: "Graduate Aptitude Test in Engineering", conducting_body: "IIT",
  exam_level: "pg_admission", purpose: "M.Tech admission", eligibility_summary: "Engineering degree",
  eligible_stages: [], age_limit_note: null, frequency: "Yearly", typical_month: "February",
  official_url: "https://gate2027.iitm.ac.in/", verified: false, last_verified: "2026-09-28" }] };
const COLLEGES = { total: 1, items: [{
  college_id: "COL_NITT", name: "National Institute of Technology Tiruchirappalli", university: null,
  type: "institute_of_national_importance", type_label: "Institute of National Importance", state: "Tamil Nadu",
  city: "Tiruchirappalli", programmes: [{ stage_id: "EDU_BTECH_CSE", name: "B.Tech – Computer Science" }],
  exams: [{ exam_id: "EXM_JEE_MAIN", name: "JEE Main", official_url: "https://jeemain.nta.nic.in/" }],
  nirf_rank: null, nirf_year: null, fees_note: "Check the official website", official_url: "https://www.nitt.edu/",
  last_verified: "2026-09-29" }] };

describe("Exams, colleges and scholarships", () => {
  beforeEach(() => {
    mockApi();
    vi.spyOn(api, "getResourceFilters").mockResolvedValue(FILTERS);
    vi.spyOn(api, "getResources").mockImplementation((kind) =>
      Promise.resolve(kind === "colleges" ? COLLEGES : kind === "exams" ? EXAMS
        : { stage: null, note: "Log in and complete your profile to filter by your stage.", total: 0, items: [] }));
  });

  it("lists exams with official links and last-checked dates", async () => {
    renderApp("/resources");
    expect(await screen.findByRole("heading", { name: "GATE" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Official website/ })).toHaveAttribute("href", "https://gate2027.iitm.ac.in/");
    expect(screen.getByText("Last checked 2026-09-28")).toBeInTheDocument();
    expect(screen.getByText("Not yet verified")).toBeInTheDocument();
    expect(screen.getByText("1 result")).toBeInTheDocument();
  });

  it("switches to colleges and filters by state", async () => {
    renderApp("/resources");
    await userEvent.click(await screen.findByRole("button", { name: "Colleges" }));
    expect(await screen.findByRole("heading", { name: /Tiruchirappalli/ })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("State"), "Tamil Nadu");
    expect(api.getResources).toHaveBeenLastCalledWith("colleges", expect.objectContaining({ state: "Tamil Nadu" }), expect.anything());
  });

  it("'only for my stage' asks visitors to log in", async () => {
    renderApp("/resources?tab=scholarships");
    await userEvent.click(await screen.findByLabelText("Only for my stage"));
    expect(api.getResources).toHaveBeenLastCalledWith("scholarships", expect.objectContaining({ for_me: true }), expect.anything());
    expect(await screen.findByText("to use this filter.", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Nothing matches these filters. Try removing one.")).toBeInTheDocument();
  });
});
