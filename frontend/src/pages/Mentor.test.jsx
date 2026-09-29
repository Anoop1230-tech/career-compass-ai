import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { httpError, mockApi, renderApp } from "../test/utils";

const reply = (over) => ({
  id: 2, role: "mentor", created_at: "2026-09-29T00:00:00Z", intent: "transition", source: "local",
  content: "Yes – it's a direct route.\n\nLearn first:\n- Statistics\n- Machine learning",
  actions: [{ label: "Full dream check", link: "/dream-check?to=CAR_DATA_SCIENTIST" },
    { label: "GATE official website", link: "https://gate2027.iitm.ac.in/" }],
  suggestions: ["Roadmap for Data Scientist"], career_id: "CAR_DATA_SCIENTIST", ...over,
});

describe("Mentor page", () => {
  beforeEach(() => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getMentorHistory").mockResolvedValue({ messages: [], suggestions: ["What should I do next?"], llm_enabled: false });
  });

  it("sends a question and shows a formatted, linked answer", async () => {
    vi.spyOn(api, "sendMentorMessage").mockResolvedValue({
      message: { id: 1, role: "user", content: "Can I become a data scientist?" }, reply: reply() });
    renderApp("/mentor");
    await userEvent.type(await screen.findByLabelText("Your question"), "Can I become a data scientist?");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    const log = screen.getByRole("list", { name: "Conversation" });
    expect(await within(log).findByText("Yes – it's a direct route.")).toBeInTheDocument();
    expect(within(log).getByText("Statistics").tagName).toBe("LI");
    expect(within(log).getByRole("link", { name: "Full dream check" })).toHaveAttribute("href", "/dream-check?to=CAR_DATA_SCIENTIST");
    expect(within(log).getByRole("link", { name: /GATE official website/ })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("button", { name: "Roadmap for Data Scientist" })).toBeInTheDocument();
    expect(screen.getByLabelText("Your question")).toHaveValue("");
  });

  it("suggestion chips send the question", async () => {
    vi.spyOn(api, "sendMentorMessage").mockResolvedValue({ message: { id: 1, role: "user", content: "x" }, reply: reply() });
    renderApp("/mentor");
    await userEvent.click(await screen.findByRole("button", { name: "What should I do next?" }));
    expect(api.sendMentorMessage).toHaveBeenCalledWith("What should I do next?");
  });

  it("keeps the question when sending fails", async () => {
    vi.spyOn(api, "sendMentorMessage").mockRejectedValue(httpError(429, { detail: "Too many attempts. Please wait a minute and try again." }));
    renderApp("/mentor");
    await userEvent.type(await screen.findByLabelText("Your question"), "hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts");
    expect(screen.getByLabelText("Your question")).toHaveValue("hello");
  });

  it("loads history and can clear it", async () => {
    api.getMentorHistory.mockResolvedValue({ messages: [{ id: 1, role: "user", content: "hi" }, reply({ content: "Hello!" })],
      suggestions: [], llm_enabled: false });
    vi.spyOn(api, "clearMentorHistory").mockResolvedValue();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderApp("/mentor");
    expect(await screen.findByText("Hello!")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear conversation" }));
    expect(api.clearMentorHistory).toHaveBeenCalled();
    expect(await screen.findByText(/Ask me anything/)).toBeInTheDocument();
  });

  it("renders mentor text safely (no HTML)", async () => {
    api.getMentorHistory.mockResolvedValue({ messages: [reply({ content: "<img src=x onerror=alert(1)>" })], suggestions: [] });
    renderApp("/mentor");
    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector(".chat img")).toBeNull();
  });
});
