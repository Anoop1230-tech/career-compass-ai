import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { mockApi, renderApp } from "../test/utils";

const EVENT = {
  key: "ED_004", exam_id: "EXM_GATE", exam_name: "GATE", event: "exam", label: "Exam", start: "2027-02-06",
  end: "2027-02-21", exact: true, source_url: "https://gate2027.iitm.ac.in/important_dates", exam_level: "pg_admission",
  exam_scope: "national", conducting_body: "IIT Madras", official_url: "https://gate2027.iitm.ac.in/", purpose: "M.Tech admission",
  can_apply: false,
};
const LIST = { today: "2026-10-15", total: 1, events: [EVENT] };

describe("Upcoming exams: reminders", () => {
  it("lets a logged-in user follow an exam with Remind me", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getUpcomingExams").mockResolvedValue(LIST);
    vi.spyOn(api, "followExam").mockResolvedValue({ exams: [], events: [] });
    renderApp("/upcoming-exams");
    const card = (await screen.findByRole("heading", { level: 3, name: /GATE/ })).closest("article");
    const button = await within(card).findByRole("button", { name: /Remind me/ });
    await userEvent.click(button);
    expect(api.followExam).toHaveBeenCalledWith("EXM_GATE", true);
    expect(await within(card).findByRole("button", { name: /Following/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("asks visitors to log in to get reminders", async () => {
    mockApi();
    vi.spyOn(api, "getUpcomingExams").mockResolvedValue(LIST);
    renderApp("/upcoming-exams");
    const card = (await screen.findByRole("heading", { level: 3, name: /GATE/ })).closest("article");
    expect(within(card).getByRole("link", { name: "Log in to get reminders" })).toHaveAttribute("href", "/login");
  });

  it("shows an alert in the menu when a followed exam date is near", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getUpcomingExams").mockResolvedValue(LIST);
    api.getAlerts.mockResolvedValue({ days: 14, count: 2, events: [] });
    renderApp("/upcoming-exams");
    expect(await screen.findByRole("link", { name: /exam dates in the next 14 days/ })).toBeInTheDocument();
  });
});
