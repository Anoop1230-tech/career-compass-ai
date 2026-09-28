import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { USER, httpError, mockApi, renderApp } from "../test/utils";

describe("Login and register", () => {
  beforeEach(() => mockApi());

  it("header shows Log in / Get started when logged out", async () => {
    renderApp("/");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(await within(nav).findByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/register");
  });

  it("validates the register form in the browser before calling the API", async () => {
    const register = vi.spyOn(api, "registerUser");
    const user = userEvent.setup();
    renderApp("/register");
    await user.click(await screen.findByRole("button", { name: "Create account" }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Use at least 8 characters.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Email/), "a@b.co");
    await user.type(screen.getByLabelText(/^Password/), "onlyletters");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Include at least one letter and one number.")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("registers and goes to the profile form", async () => {
    vi.spyOn(api, "registerUser").mockResolvedValue(USER);
    const user = userEvent.setup();
    renderApp("/register");
    await user.type(await screen.findByLabelText(/Email/), "  asha@example.com ");
    await user.type(screen.getByLabelText(/^Password/), "secret123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(api.registerUser).toHaveBeenCalledWith("asha@example.com", "secret123");
    expect(await screen.findByRole("heading", { name: "Create your profile" })).toBeInTheDocument();
    expect(screen.getByText("asha@example.com")).toBeInTheDocument(); // header shows the user
  });

  it("shows the server error for a duplicate email", async () => {
    vi.spyOn(api, "registerUser").mockRejectedValue(httpError(409, { detail: "An account with this email already exists." }));
    const user = userEvent.setup();
    renderApp("/register");
    await user.type(await screen.findByLabelText(/Email/), "asha@example.com");
    await user.type(screen.getByLabelText(/^Password/), "secret123");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
  });

  it("wrong password shows a message and keeps the user on the page", async () => {
    vi.spyOn(api, "loginUser").mockRejectedValue(httpError(401, { detail: "Incorrect email or password." }));
    const user = userEvent.setup();
    renderApp("/login");
    await user.type(await screen.findByLabelText(/Email/), "asha@example.com");
    await user.type(screen.getByLabelText(/^Password/), "wrong");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("show password toggles the input type", async () => {
    const user = userEvent.setup();
    renderApp("/login");
    const input = await screen.findByLabelText(/^Password/);
    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getByLabelText("Show password"));
    expect(input).toHaveAttribute("type", "text");
  });

  it("protected pages send logged-out users to login, then back", async () => {
    vi.spyOn(api, "loginUser").mockResolvedValue({ ...USER, has_profile: false });
    const user = userEvent.setup();
    renderApp("/profile/edit");
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Email/), "asha@example.com");
    await user.type(screen.getByLabelText(/^Password/), "secret123");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("heading", { name: "Create your profile" })).toBeInTheDocument();
  });
});

describe("Logged in", () => {
  it("logged-in users visiting /login are redirected", async () => {
    mockApi({ loggedIn: true });
    renderApp("/login");
    expect(await screen.findByRole("heading", { name: "Create your profile" })).toBeInTheDocument();
  });

  it("log out returns to home and shows Log in again", async () => {
    mockApi({ loggedIn: true });
    const user = userEvent.setup();
    renderApp("/explore");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    await user.click(await within(nav).findByRole("button", { name: "Log out" }));
    expect(api.logoutUser).toHaveBeenCalled();
    await waitFor(() => expect(within(nav).getByRole("link", { name: "Log in" })).toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 1, name: /where are you now/i })).toBeInTheDocument();
  });
});
