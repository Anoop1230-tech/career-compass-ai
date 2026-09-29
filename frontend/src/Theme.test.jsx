import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredTheme, resolveTheme } from "./theme";
import { mockApi, renderApp } from "./test/utils";

function mockMedia(matches) {
  vi.stubGlobal("matchMedia", (query) => ({
    matches: Boolean(matches[query]), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
}

describe("Themes", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    mockMedia({});
  });
  afterEach(() => vi.unstubAllGlobals());

  it("defaults to matching the device and ignores unknown saved values", () => {
    expect(getStoredTheme()).toBe("system");
    localStorage.setItem("cc-theme", "neon");
    expect(getStoredTheme()).toBe("system");
    localStorage.setItem("cc-theme", "dark");
    expect(getStoredTheme()).toBe("dark");
  });

  it("resolves 'match device' from the system settings", () => {
    expect(resolveTheme("system")).toBe("light");
    mockMedia({ "(prefers-color-scheme: dark)": true });
    expect(resolveTheme("system")).toBe("dark");
    mockMedia({ "(prefers-color-scheme: dark)": true, "(prefers-contrast: more)": true });
    expect(resolveTheme("system")).toBe("contrast");
    expect(resolveTheme("light")).toBe("light");
  });

  it("the picker in the menu applies and saves the choice", async () => {
    mockApi();
    renderApp("/");
    const dark = await screen.findByRole("radio", { name: "Dark" });
    expect(screen.getByRole("radio", { name: "Match device" })).toBeChecked();
    expect(screen.getByRole("group", { name: /Theme/ })).toHaveTextContent("Match device");
    await userEvent.click(dark);
    expect(dark).toBeChecked();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("cc-theme")).toBe("dark");
    await userEvent.click(screen.getByRole("radio", { name: "High contrast" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "contrast");
    expect(screen.getByRole("group", { name: /Theme/ })).toHaveTextContent("High contrast");
  });
});
