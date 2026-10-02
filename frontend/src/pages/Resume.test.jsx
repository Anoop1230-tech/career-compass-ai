import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { mockApi, renderApp } from "../test/utils";

const FOUND = {
  pages: 1, has_profile: true,
  skills: [
    { skill_id: "SKL_PYTHON", name: "Python", matched: "Python", category: "programming", in_profile: true },
    { skill_id: "SKL_SQL", name: "SQL", matched: "SQL", category: "programming", in_profile: false },
    { skill_id: "SKL_EXCEL", name: "Excel", matched: "Excel", category: "technical", in_profile: false },
  ],
};

describe("Résumé upload", () => {
  it("reads skills, lets the user untick and pick levels, and saves only confirmed ones", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "readResumeSkills").mockResolvedValue(FOUND);
    const profile = { full_name: "Asha Kumar", skills: [{ name: "Python", category: "programming", level: "advanced" }], updated_at: "2026-10-01T00:00:00Z" };
    api.getProfile.mockResolvedValue(profile);
    vi.spyOn(api, "saveProfile").mockResolvedValue(profile);
    renderApp("/profile/resume");

    const input = await screen.findByLabelText("Résumé (PDF)");
    await userEvent.upload(input, new File(["%PDF-1.4"], "cv.pdf", { type: "application/pdf" }));
    await userEvent.click(screen.getByRole("button", { name: "Read skills" }));
    expect(await screen.findByText(/3 skills found on 1 pages/)).toBeInTheDocument();
    expect(api.saveProfile).not.toHaveBeenCalled();

    expect(screen.getByRole("checkbox", { name: "Python" })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: "Excel" }));
    await userEvent.selectOptions(screen.getByLabelText("Level for SQL"), "advanced");
    await userEvent.click(screen.getByRole("button", { name: "Add 1 skills to my profile" }));

    await waitFor(() => expect(api.saveProfile).toHaveBeenCalled());
    const saved = api.saveProfile.mock.calls[0][0];
    expect(saved.updated_at).toBeUndefined();
    expect(saved.skills).toContainEqual({ name: "SQL", category: "programming", level: "advanced" });
    expect(saved.skills.some((s) => s.name === "Excel")).toBe(false);
    expect(await screen.findByText("1 skills added to your profile.")).toBeInTheDocument();
  });

  it("shows the server's reason when the PDF cannot be read", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "readResumeSkills").mockRejectedValue(
      Object.assign(new Error("x"), { response: { status: 422, data: { detail: "No text", code: "resume.no_text" } } }));
    renderApp("/profile/resume");
    await userEvent.upload(await screen.findByLabelText("Résumé (PDF)"), new File(["%PDF"], "scan.pdf", { type: "application/pdf" }));
    await userEvent.click(screen.getByRole("button", { name: "Read skills" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/scanned image/);
  });
});
