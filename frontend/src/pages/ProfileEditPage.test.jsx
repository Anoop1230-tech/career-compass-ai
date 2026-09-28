import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { httpError, mockApi, renderApp } from "../test/utils";

const SAVED = {
  full_name: "Asha Verma", age: null, location: null, current_stage: "ug_student", bio: null,
  education: { degree: "B.Tech", branch: null, stream: null, institution: null, year_of_study: null, graduation_year: null, score_type: null, score: null },
  skills: [{ name: "Python", category: "programming", level: "advanced" }],
  certifications: [],
  experience: { total_years: null, current_role: null, internships: [], jobs: [], projects: [] },
  interests: ["technology"], goals: ["job"],
  preferences: { work_mode: "any", preferred_locations: [], open_to_relocation: true },
  updated_at: "2026-09-28T00:00:00Z",
};

// Like the real API: once saved, GET /profile returns the saved profile
function saveSucceeds() {
  return async () => {
    api.getProfile.mockResolvedValue(SAVED);
    return SAVED;
  };
}

async function fillBasics(user) {
  await user.type(await screen.findByLabelText(/Full name/), "Asha Verma");
  await user.selectOptions(screen.getByLabelText(/Where are you now/), "ug_student");
}

describe("Profile form", () => {
  beforeEach(() => mockApi({ loggedIn: true }));

  it("blocks Continue until name and stage are filled", async () => {
    const user = userEvent.setup();
    renderApp("/profile/edit");
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    expect(screen.getByText(/Enter your name/)).toBeInTheDocument();
    expect(screen.getByText(/Choose the stage/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "About you" })).toBeInTheDocument();
  });

  it("shows school fields for Class 10 and degree fields for college", async () => {
    const user = userEvent.setup();
    renderApp("/profile/edit");
    await user.type(await screen.findByLabelText(/Full name/), "Ravi");
    await user.selectOptions(screen.getByLabelText(/Where are you now/), "class_10");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText(/Stream/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Branch/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.selectOptions(screen.getByLabelText(/Where are you now/), "ug_student");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText(/Branch/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Stream/)).not.toBeInTheDocument();
  });

  it("fills every step and saves the cleaned profile", async () => {
    vi.spyOn(api, "saveProfile").mockImplementation(saveSucceeds());
    const user = userEvent.setup();
    renderApp("/profile/edit");
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.type(screen.getByLabelText(/Highest \/ current degree/), "B.Tech");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.click(screen.getByRole("button", { name: "+ Add skill" }));
    await user.type(screen.getByLabelText(/^Skill/), "Python");
    await user.selectOptions(screen.getByLabelText(/^Level/), "advanced");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" })); // experience: skip

    await user.click(screen.getByLabelText("Technology"));
    await user.click(screen.getByLabelText("Get a job"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    const body = api.saveProfile.mock.calls[0][0];
    expect(body).toMatchObject({
      full_name: "Asha Verma",
      current_stage: "ug_student",
      education: { degree: "B.Tech" },
      skills: [{ name: "Python", level: "advanced" }],
      interests: ["technology"],
      goals: ["job"],
    });
    // Saved -> summary page
    expect(await screen.findByRole("heading", { level: 1, name: "Asha Verma" })).toBeInTheDocument();
    expect(screen.getByText("Profile saved.")).toBeInTheDocument();
  });

  it("server validation errors jump to the right step and highlight the field", async () => {
    vi.spyOn(api, "saveProfile").mockRejectedValue(
      httpError(422, {
        detail: "skills.0.name: String should have at least 1 character",
        errors: [{ field: "skills.0.name", message: "Skill name is required" }],
      }),
    );
    const user = userEvent.setup();
    renderApp("/profile/edit");
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Save now" }));
    expect(await screen.findByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("skills.0.name");
  });

  it("a network failure keeps the data and allows retrying", async () => {
    vi.spyOn(api, "saveProfile")
      .mockRejectedValueOnce(Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }))
      .mockImplementationOnce(saveSucceeds());
    const user = userEvent.setup();
    renderApp("/profile/edit");
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Save now" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the server");
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Asha Verma");

    await user.click(screen.getByRole("button", { name: "Save now" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Asha Verma" })).toBeInTheDocument();
  });

  it("shows a retry screen when the profile cannot load", async () => {
    api.getProfileOptions.mockRejectedValueOnce(httpError(503, { detail: "The database is unavailable." }));
    const user = userEvent.setup();
    renderApp("/profile/edit");
    expect(await screen.findByRole("alert")).toHaveTextContent("The database is unavailable.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Create your profile" })).toBeInTheDocument();
  });
});

describe("Profile summary", () => {
  it("shows the saved profile", async () => {
    mockApi({ loggedIn: true, profile: SAVED });
    renderApp("/profile");
    expect(await screen.findByRole("heading", { level: 1, name: "Asha Verma" })).toBeInTheDocument();
    const skills = screen.getByRole("heading", { name: "Skills" }).closest("article");
    expect(within(skills).getByText("Python · Advanced")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit profile" })).toHaveAttribute("href", "/profile/edit");
  });

  it("sends users without a profile to the form", async () => {
    mockApi({ loggedIn: true });
    renderApp("/profile");
    expect(await screen.findByRole("heading", { name: "Create your profile" })).toBeInTheDocument();
  });

  it("editing loads existing values", async () => {
    mockApi({ loggedIn: true, profile: SAVED });
    renderApp("/profile/edit");
    expect(await screen.findByRole("heading", { name: "Edit your profile" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Asha Verma");
  });
});
