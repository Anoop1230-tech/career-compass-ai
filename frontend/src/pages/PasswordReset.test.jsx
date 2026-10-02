import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { httpError, mockApi, renderApp } from "../test/utils";

const PROFILE = {
  full_name: "Asha Verma", age: null, location: null, current_stage: "ug_student", bio: null,
  education: { degree: "B.Tech" },
  skills: [], certifications: [],
  experience: { total_years: null, current_role: null, internships: [], jobs: [], projects: [] },
  interests: [], goals: [],
  preferences: { work_mode: "any", preferred_locations: [], open_to_relocation: true },
};

describe("Forgot and reset password", () => {
  beforeEach(() => mockApi());

  it("login page links to Forgot password", async () => {
    const user = userEvent.setup();
    renderApp("/login");
    await user.click(await screen.findByRole("link", { name: "Forgot password?" }));
    expect(await screen.findByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
  });

  it("sends the reset request and shows the neutral message", async () => {
    vi.spyOn(api, "requestPasswordReset").mockResolvedValue({ detail: "If an account exists for this email, we have sent a link." });
    const user = userEvent.setup();
    renderApp("/forgot-password");
    await user.click(await screen.findByRole("button", { name: "Send reset link" }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(api.requestPasswordReset).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Email/), " asha@example.com ");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(api.requestPasswordReset).toHaveBeenCalledWith("asha@example.com");
    expect(await screen.findByText(/If an account exists/)).toHaveAttribute("role", "status");
  });

  it("reset page without a token explains what is wrong", async () => {
    renderApp("/reset-password");
    expect(await screen.findByRole("alert")).toHaveTextContent("needs the link from your reset email");
  });

  it("sets a new password from the email link and goes to login", async () => {
    vi.spyOn(api, "confirmPasswordReset").mockResolvedValue();
    const user = userEvent.setup();
    renderApp("/reset-password#token=abc123abc123abc123abc123");
    await user.type(await screen.findByLabelText(/^New password/), "newpass99");
    await user.type(screen.getByLabelText(/Repeat new password/), "different1");
    await user.click(screen.getByRole("button", { name: "Save new password" }));
    expect(screen.getByText("The two passwords do not match.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Repeat new password/));
    await user.type(screen.getByLabelText(/Repeat new password/), "newpass99");
    await user.click(screen.getByRole("button", { name: "Save new password" }));
    expect(api.confirmPasswordReset).toHaveBeenCalledWith("abc123abc123abc123abc123", "newpass99");
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByText(/Your password was changed/)).toHaveAttribute("role", "status");
  });

  it("shows the server message for an expired link", async () => {
    vi.spyOn(api, "confirmPasswordReset").mockRejectedValue(
      httpError(400, { detail: "This reset link is invalid or has expired. Please request a new one." }));
    const user = userEvent.setup();
    renderApp("/reset-password#token=abc123abc123abc123abc123");
    await user.type(await screen.findByLabelText(/^New password/), "newpass99");
    await user.type(screen.getByLabelText(/Repeat new password/), "newpass99");
    await user.click(screen.getByRole("button", { name: "Save new password" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("expired");
    expect(within(alert).getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
  });
});

describe("Change password", () => {
  beforeEach(() => mockApi({ loggedIn: true, profile: PROFILE }));

  it("validates, saves and confirms", async () => {
    vi.spyOn(api, "changePassword").mockResolvedValue({});
    const user = userEvent.setup();
    renderApp("/profile");
    await user.click(await screen.findByRole("button", { name: "Change password" }));
    const form = screen.getByRole("form", { name: "Change password" });
    await user.click(within(form).getByRole("button", { name: "Save new password" }));
    expect(within(form).getByText("Enter your current password.")).toBeInTheDocument();
    expect(api.changePassword).not.toHaveBeenCalled();

    await user.type(within(form).getByLabelText(/Current password/), "secret123");
    await user.type(within(form).getByLabelText(/^New password/), "newpass99");
    await user.type(within(form).getByLabelText(/Repeat new password/), "newpass99");
    await user.click(within(form).getByRole("button", { name: "Save new password" }));
    expect(api.changePassword).toHaveBeenCalledWith("secret123", "newpass99");
    expect(await screen.findByText(/Password changed/)).toBeInTheDocument();
  });

  it("shows a wrong current password error", async () => {
    vi.spyOn(api, "changePassword").mockRejectedValue(httpError(400, { detail: "Your current password is incorrect." }));
    const user = userEvent.setup();
    renderApp("/profile");
    await user.click(await screen.findByRole("button", { name: "Change password" }));
    const form = screen.getByRole("form", { name: "Change password" });
    await user.type(within(form).getByLabelText(/Current password/), "wrong123");
    await user.type(within(form).getByLabelText(/^New password/), "newpass99");
    await user.type(within(form).getByLabelText(/Repeat new password/), "newpass99");
    await user.click(within(form).getByRole("button", { name: "Save new password" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("current password is incorrect");
  });
});
