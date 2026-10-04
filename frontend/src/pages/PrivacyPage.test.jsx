import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { mockApi, renderApp } from "../test/utils";

describe("Privacy policy", () => {
  beforeEach(() => mockApi());

  it("is public and explains what is collected, with a contact address", async () => {
    renderApp("/privacy");
    expect(await screen.findByRole("heading", { level: 1, name: "Privacy policy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What we collect" })).toBeInTheDocument();
    expect(screen.getByText(/we receive only your email address/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "kumaranoop849250@gmail.com" })).toHaveAttribute(
      "href", "mailto:kumaranoop849250@gmail.com",
    );
  });

  it("is linked from the footer on every page", async () => {
    renderApp("/");
    const footer = await screen.findByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });

  it("is available in Hindi", async () => {
    renderApp("/privacy", { lang: "hi" });
    expect(await screen.findByRole("heading", { level: 1, name: "गोपनीयता नीति" })).toBeInTheDocument();
  });
});
