import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { mockApi, renderApp } from "../test/utils";

const DATA = {
  exams: [
    { exam_id: "EXM_GATE", name: "GATE", official_url: "https://gate2027.iitm.ac.in/", email: true, has_exact_dates: true },
    { exam_id: "EXM_CAT", name: "CAT", official_url: "https://iimcat.ac.in/", email: false, has_exact_dates: false },
  ],
  events: [
    { key: "ED_003", exam_id: "EXM_GATE", exam_name: "GATE", event: "admit_card", start: "2027-01-04", end: "2027-01-04",
      exact: true, source_url: "https://gate2027.iitm.ac.in/important_dates" },
    { key: "EXM_CAT:2026-11", exam_id: "EXM_CAT", exam_name: "CAT", event: "usual_month", start: "2026-11-01",
      end: "2026-11-30", exact: false, source_url: "https://iimcat.ac.in/" },
  ],
};

describe("Exam reminders", () => {
  it("dashboard lists coming dates, marks unconfirmed months and offers the calendar", async () => {
    mockApi({ loggedIn: true });
    api.getReminders.mockResolvedValue(DATA);
    vi.spyOn(api, "followExam").mockResolvedValue({ ...DATA, exams: [{ ...DATA.exams[0], email: false }, DATA.exams[1]] });
    renderApp("/dashboard");
    const section = await screen.findByRole("region", { name: "Coming up" });
    expect(within(section).getByText(/Admit card · 4 Jan 2027/)).toBeInTheDocument();
    expect(within(section).getByText(/usually in November 2026/)).toBeInTheDocument();
    expect(within(section).getByText("not confirmed")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "Download calendar (.ics)" }))
      .toHaveAttribute("href", "/api/reminders/calendar.ics");

    const box = within(section).getByRole("checkbox", { name: "Email me reminders for GATE" });
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(api.followExam).toHaveBeenCalledWith("EXM_GATE", false);
    await waitFor(() => expect(box).not.toBeChecked());
  });

  it("resources: signed-in users can follow an exam from its card", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getResourceFilters").mockResolvedValue({ states: [], college_types: [], exams: [], provider_types: [] });
    vi.spyOn(api, "getResources").mockResolvedValue({ total: 1, items: [{
      exam_id: "EXM_GATE", name: "GATE", full_name: "Graduate Aptitude Test in Engineering", conducting_body: "IITs",
      exam_level: "pg_admission", purpose: "M.Tech", eligibility_summary: "Engineers", typical_month: "February",
      official_url: "https://gate2027.iitm.ac.in/", verified: false, last_verified: "2026-09-28" }] });
    vi.spyOn(api, "followExam").mockResolvedValue(DATA);
    renderApp("/resources?tab=exams");
    const btn = await screen.findByRole("button", { name: "Follow GATE" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(btn);
    expect(api.followExam).toHaveBeenCalledWith("EXM_GATE");
    expect(await screen.findByRole("button", { name: "Following GATE" })).toHaveAttribute("aria-pressed", "true");
  });
});
