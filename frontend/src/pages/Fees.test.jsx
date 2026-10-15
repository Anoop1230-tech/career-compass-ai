import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { mockApi, renderApp } from "../test/utils";

const STAGES = [
  { stage_id: "EDU_BTECH_CIVIL", name: "B.Tech – Civil", level: "ug" },
  { stage_id: "EDU_MBBS", name: "MBBS (medicine)", level: "ug" },
];
const FEE = {
  fee_id: "FEE_IITD_BTECH_S1_ABOVE5L", institution: "IIT Delhi", institute_type: "iit", band: "income_above_5l",
  period: "first_semester", amount: 131000, includes_note: "Tuition fee Rs 1,00,000 for the semester",
  excludes_note: "Mess charges are extra", waiver_note: "Family income below Rs 1 lakh: no tuition fee",
  source_name: "IIT Delhi fee structure", source_url: "https://home.iitd.ac.in/fees.pdf", as_of: "2025-07-01",
  last_verified: "2026-10-15",
};
const SCHOLARSHIP = {
  scholarship_id: "SCH_AICTE_PRAGATI", name: "AICTE Pragati Scholarship for Girl Students", provider: "AICTE",
  provider_label: "Central government", eligibility_summary: "Girl students in technical courses",
  income_limit_note: "Family income limit applies", gender_note: "Girls only", category_note: null,
  amount_note: "Check current guidelines", official_url: "https://www.aicte-india.org/",
};

describe("Fees and scholarships", () => {
  beforeEach(() => {
    mockApi();
    vi.spyOn(api, "getStages").mockResolvedValue(STAGES);
  });

  it("shows official fees with the source, and matching scholarships", async () => {
    vi.spyOn(api, "getFees").mockResolvedValue({
      stage: { stage_id: "EDU_BTECH_CIVIL", name: "B.Tech – Civil" }, note: null, band: null,
      fees: [FEE], has_official_fees: true, scholarships: [SCHOLARSHIP],
    });
    renderApp("/fees?stage=EDU_BTECH_CIVIL");
    const card = (await screen.findByRole("heading", { level: 3, name: "IIT Delhi" })).closest("article");
    expect(within(card).getByText("₹1,31,000")).toBeInTheDocument();
    expect(within(card).getByText("First semester")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /IIT Delhi fee structure/ })).toHaveAttribute("href", "https://home.iitd.ac.in/fees.pdf");
    expect(screen.getByRole("link", { name: /AICTE Pragati/ })).toBeInTheDocument();
    expect(api.getFees).toHaveBeenCalledWith({ stage: "EDU_BTECH_CIVIL", band: undefined, forMe: false }, expect.anything());
  });

  it("says plainly when there is no official fee notice", async () => {
    vi.spyOn(api, "getFees").mockResolvedValue({
      stage: { stage_id: "EDU_MBBS", name: "MBBS (medicine)" }, note: null, band: null,
      fees: [], has_official_fees: false, scholarships: [],
    });
    renderApp("/fees?stage=EDU_MBBS");
    expect(await screen.findByText(/do not have an official fee notice/)).toBeInTheDocument();
  });

  it("filters by family income", async () => {
    vi.spyOn(api, "getFees").mockResolvedValue({ stage: null, note: null, band: null, fees: [], has_official_fees: false, scholarships: [] });
    renderApp("/fees");
    await userEvent.selectOptions(await screen.findByLabelText("Family income or category"), "income_below_1l");
    expect(api.getFees).toHaveBeenLastCalledWith({ stage: undefined, band: "income_below_1l", forMe: true }, expect.anything());
  });
});
