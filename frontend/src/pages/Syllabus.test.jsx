import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { mockApi, renderApp } from "../test/utils";

const exam = (over) => ({
  exam_id: "EXM_GRE", name: "GRE", full_name: "Graduate Record Examinations", conducting_body: "ETS",
  exam_level: "pg_admission", purpose: "Study abroad", eligibility_summary: "Graduates", typical_month: "Book any time",
  official_url: "https://www.ets.org/gre.html", verified: false, last_verified: "2026-09-28", syllabus: null, ...over,
});

describe("Exam syllabus button", () => {
  it("opens the sections and the official syllabus link; falls back to the official site", async () => {
    mockApi();
    vi.spyOn(api, "getResourceFilters").mockResolvedValue({ states: [], college_types: [], exams: [], provider_types: [], exam_levels: [] });
    vi.spyOn(api, "getResources").mockResolvedValue({ total: 2, items: [
      exam({ syllabus: { url: "https://www.ets.org/gre/test-takers/general-test/prepare/content.html", format: "page",
        sections: ["Verbal Reasoning", "Quantitative Reasoning", "Analytical Writing"], last_verified: "2026-10-04" } }),
      exam({ exam_id: "EXM_CAT", name: "CAT", official_url: "https://iimcat.ac.in/" }),
    ] });
    renderApp("/resources?tab=exams");

    const btn = await screen.findByRole("button", { name: "Syllabus GRE" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("region", { name: "Syllabus for GRE" });
    expect(within(panel).getByText("Quantitative Reasoning")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: /Full official syllabus/ }))
      .toHaveAttribute("href", "https://www.ets.org/gre/test-takers/general-test/prepare/content.html");

    await userEvent.click(screen.getByRole("button", { name: "Syllabus CAT" }));
    const cat = screen.getByRole("region", { name: "Syllabus for CAT" });
    expect(within(cat).getByText("For the CAT syllabus, please visit the official website of this exam:")).toBeInTheDocument();
    expect(within(cat).getByRole("link", { name: /iimcat\.ac\.in/ })).toHaveAttribute("href", "https://iimcat.ac.in/");
  });
});
