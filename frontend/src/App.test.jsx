import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { NAV_GROUPS, NAV_ITEMS } from "./navigation";
import * as api from "./services/api";
import { mockApi, renderApp as renderAt } from "./test/utils";

describe("App shell", () => {
  beforeEach(() => {
    mockApi();
  });

  it("renders the home page with main heading", async () => {
    renderAt("/");
    expect(await screen.findByRole("heading", { level: 1, name: /where are you now/i })).toBeInTheDocument();
  });

  it("shows every nav item in the header", async () => {
    renderAt("/");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    for (const item of NAV_ITEMS) {
      expect(within(nav).getByRole("link", { name: item.label })).toBeInTheDocument();
    }
  });

  it("groups the menu into journey, explore and prepare sections", async () => {
    renderAt("/");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    for (const group of NAV_GROUPS) {
      const section = within(nav).getByRole("group", { name: group.label });
      expect(within(section).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(
        group.items.map((item) => item.path),
      );
    }
  });

  it("home page lists every feature, grouped the same way as the menu", async () => {
    renderAt("/");
    const features = (await screen.findByRole("heading", { name: "Everything in one place" })).closest("section");
    const hrefs = within(features).getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(NAV_ITEMS.map((item) => item.path));
  });


  it("navigates when a nav link is clicked", async () => {
    const user = userEvent.setup();
    renderAt("/");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    await user.click(within(nav).getByRole("link", { name: "Careers" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Careers" })).toBeInTheDocument();
  });

  it("shows a 404 page for unknown routes", async () => {
    renderAt("/this/does/not/exist");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  it("shows 'Server online' when the backend is healthy", async () => {
    renderAt("/");
    expect(await screen.findByText("Server online")).toBeInTheDocument();
  });

  it("shows offline status and recovers after Retry", async () => {
    api.getHealth.mockRejectedValueOnce({ message: "Network Error" });
    const user = userEvent.setup();
    renderAt("/");
    expect(await screen.findByText("Server offline")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Server online")).toBeInTheDocument();
  });
});

describe("Mobile menu", () => {
  beforeEach(() => {
    mockApi();
  });

  it("opens, closes with Escape, and closes after picking a link", async () => {
    const user = userEvent.setup();
    renderAt("/");
    const toggle = await screen.findByRole("button", { name: "Open menu" });

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    const nav = screen.getByRole("navigation", { name: "Main" });
    await user.click(within(nav).getByRole("link", { name: "Roadmap" }));
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));
  });
});
