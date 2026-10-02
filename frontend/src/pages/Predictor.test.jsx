import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { mockApi, renderApp } from "../test/utils";

const RESULT = {
  counts: { likely: 1, borderline: 1, unlikely: 0 }, total: 2,
  items: [
    { institute_name: "National Institute of Technology Warangal", institute_type: "nit", stage_id: "EDU_BTECH_CSE",
      program_name: "CSE", quota: "OS", gender: "neutral", opening_rank: 900, closing_rank: 3000, band: "likely" },
    { institute_name: "National Institute of Technology Calicut", institute_type: "nit", stage_id: "EDU_BTECH_ECE",
      program_name: "ECE", quota: "OS", gender: "female", opening_rank: 5000, closing_rank: 9000, band: "borderline" },
  ],
  source: { year: 2025, round: 6, url: "https://josaa.admissions.nic.in/", last_verified: "2026-10-03" },
  thresholds: { likely: 0.85, borderline: 1.1 },
};

describe("College predictor", () => {
  it("sends the rank and shows banded colleges with the source", async () => {
    mockApi();
    vi.spyOn(api, "predictColleges").mockResolvedValue(RESULT);
    renderApp("/college-predictor");
    expect(await screen.findByRole("heading", { level: 1, name: "College predictor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show colleges" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Your rank (common rank list)"), "2400");
    await userEvent.click(screen.getByLabelText(/I am female/));
    await userEvent.click(screen.getByRole("button", { name: "Show colleges" }));
    expect(api.predictColleges).toHaveBeenLastCalledWith(
      { exam: "EXM_JEE_MAIN", rank: 2400, seat_type: "OPEN", female: true, include_unlikely: false }, expect.anything());

    const table = await screen.findByRole("table", { name: /chance of admission/ });
    expect(within(table).getByText("Likely")).toBeInTheDocument();
    expect(within(table).getByText("Borderline")).toBeInTheDocument();
    expect(within(table).getByText("3,000")).toBeInTheDocument();
    expect(screen.getByText(/1 likely and 1 borderline options/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /JoSAA/ })).toHaveAttribute("href", "https://josaa.admissions.nic.in/");
  });

  it("category seats ask for the category rank", async () => {
    mockApi();
    renderApp("/college-predictor?seat=SC");
    expect(await screen.findByLabelText("Your category rank")).toBeInTheDocument();
  });
});
