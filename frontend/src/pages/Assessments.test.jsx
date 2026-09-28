import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { httpError, mockApi, renderApp } from "../test/utils";

const HUB = [
  { kind: "interest", title: "Interest profile", description: "d", minutes: 5, question_count: 3, completed_at: null, in_progress: false },
  { kind: "personality", title: "Personality and work style", description: "d", minutes: 5, question_count: 2, completed_at: null, in_progress: true },
  { kind: "aptitude", title: "Aptitude quiz", description: "d", minutes: 25, question_count: 2, completed_at: "2026-09-28T10:00:00Z", in_progress: false },
];

const INTEREST_TEST = {
  attempt_id: 7, kind: "interest", title: "Interest profile", scale: "like",
  questions: [
    { question_id: "IQ_1", text: "Build things" },
    { question_id: "IQ_2", text: "Solve puzzles" },
    { question_id: "IQ_3", text: "Draw pictures" },
  ],
};

const APTITUDE_TEST = {
  attempt_id: 9, kind: "aptitude", title: "Aptitude quiz", scale: "choice",
  questions: [
    { question_id: "AQ_1", text: "2 + 2 = ?", category: "numerical",
      options: [{ key: "a", text: "3" }, { key: "b", text: "4" }, { key: "c", text: "5" }, { key: "d", text: "6" }] },
    { question_id: "AQ_2", text: "Opposite of hot?", category: "verbal",
      options: [{ key: "a", text: "Cold" }, { key: "b", text: "Warm" }, { key: "c", text: "Red" }, { key: "d", text: "Big" }] },
  ],
};

const INTEREST_RESULT = {
  kind: "interest", created_at: "2026-09-29T00:00:00Z",
  result: {
    top_code: "IRA", top_types: ["Investigative", "Realistic", "Artistic"], undifferentiated: false,
    scales: [
      { key: "R", score: 75, band: "high", answered: 1 },
      { key: "I", score: 100, band: "high", answered: 1 },
      { key: "A", score: 25, band: "low", answered: 1 },
    ],
  },
};

const APTITUDE_RESULT = {
  kind: "aptitude", created_at: "2026-09-29T00:00:00Z",
  result: {
    overall: 50, correct: 1, total: 2,
    scales: [{ key: "numerical", score: 100, band: "high", correct: 1, total: 1, skipped: 0 },
             { key: "verbal", score: 0, band: "low", correct: 0, total: 1, skipped: 1 }],
    details: [
      { question_id: "AQ_1", chosen: "b", correct_option: "b", is_correct: true, text: "2 + 2 = ?", category: "numerical",
        options: [{ key: "a", text: "3" }, { key: "b", text: "4" }, { key: "c", text: "5" }, { key: "d", text: "6" }], explanation: "Basic sum" },
      { question_id: "AQ_2", chosen: null, correct_option: "a", is_correct: false, text: "Opposite of hot?", category: "verbal",
        options: [{ key: "a", text: "Cold" }, { key: "b", text: "Warm" }, { key: "c", text: "Red" }, { key: "d", text: "Big" }], explanation: "Cold is the opposite" },
    ],
  },
};

beforeEach(() => {
  window.localStorage.clear();
  mockApi({ loggedIn: true });
});
afterEach(() => window.localStorage.clear());

describe("Assessments hub", () => {
  it("shows each test with the right action", async () => {
    vi.spyOn(api, "getAssessments").mockResolvedValue(HUB);
    renderApp("/assessments");
    const interest = (await screen.findByRole("heading", { name: "Interest profile" })).closest("article");
    expect(within(interest).getByRole("link", { name: "Start" })).toHaveAttribute("href", "/assessments/interest");
    const personality = screen.getByRole("heading", { name: "Personality and work style" }).closest("article");
    expect(within(personality).getByRole("link", { name: "Continue" })).toBeInTheDocument();
    const aptitude = screen.getByRole("heading", { name: "Aptitude quiz" }).closest("article");
    expect(within(aptitude).getByRole("link", { name: "View result" })).toHaveAttribute("href", "/assessments/aptitude/result");
    expect(screen.getByText(/not a clinical/)).toBeInTheDocument();
  });

  it("requires login", async () => {
    mockApi({ loggedIn: false });
    renderApp("/assessments");
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("shows an error with retry", async () => {
    vi.spyOn(api, "getAssessments").mockRejectedValueOnce(httpError(503, { detail: "Down" })).mockResolvedValue(HUB);
    const user = userEvent.setup();
    renderApp("/assessments");
    expect(await screen.findByRole("alert")).toHaveTextContent("Down");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Aptitude quiz" })).toBeInTheDocument();
  });
});

describe("Taking a test", () => {
  it("answers every question and submits the ratings", async () => {
    vi.spyOn(api, "startAssessment").mockResolvedValue(INTEREST_TEST);
    vi.spyOn(api, "submitAssessment").mockResolvedValue(INTEREST_RESULT);
    vi.spyOn(api, "getAssessmentResult").mockResolvedValue(INTEREST_RESULT);
    const user = userEvent.setup();
    renderApp("/assessments/interest");

    expect(await screen.findByRole("heading", { name: "Build things" })).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 3 · 0 answered")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Strongly like"));
    expect(await screen.findByRole("heading", { name: "Solve puzzles" })).toBeInTheDocument(); // auto-advance
    await user.click(screen.getByLabelText("Like"));
    await screen.findByRole("heading", { name: "Draw pictures" });
    await user.click(screen.getByLabelText("Strongly dislike"));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(api.submitAssessment).toHaveBeenCalledWith("interest", 7, { IQ_1: 5, IQ_2: 4, IQ_3: 1 });
    expect(await screen.findByText("IRA")).toBeInTheDocument();
    expect(window.localStorage.getItem("cc_assessment_interest_7")).toBeNull(); // progress cleared
  });

  it("does not submit a rating test with unanswered questions", async () => {
    vi.spyOn(api, "startAssessment").mockResolvedValue(INTEREST_TEST);
    vi.spyOn(api, "submitAssessment");
    const user = userEvent.setup();
    renderApp("/assessments/interest");
    await screen.findByRole("heading", { name: "Build things" });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("3 left");
    expect(api.submitAssessment).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Build things" })).toBeInTheDocument(); // jumped to first unanswered
  });

  it("resumes saved answers after a refresh", async () => {
    window.localStorage.setItem("cc_assessment_interest_7", JSON.stringify({ answers: { IQ_1: 4, IQ_GONE: 2 }, index: 1 }));
    vi.spyOn(api, "startAssessment").mockResolvedValue(INTEREST_TEST);
    renderApp("/assessments/interest");
    expect(await screen.findByRole("heading", { name: "Solve puzzles" })).toBeInTheDocument();
    expect(screen.getByText("Question 2 of 3 · 1 answered")).toBeInTheDocument(); // unknown ids dropped
  });

  it("ignores corrupted saved progress", async () => {
    window.localStorage.setItem("cc_assessment_interest_7", "{not json");
    vi.spyOn(api, "startAssessment").mockResolvedValue(INTEREST_TEST);
    renderApp("/assessments/interest");
    expect(await screen.findByText("Question 1 of 3 · 0 answered")).toBeInTheDocument();
  });

  it("aptitude allows skipping and asks before submitting with blanks", async () => {
    vi.spyOn(api, "startAssessment").mockResolvedValue(APTITUDE_TEST);
    vi.spyOn(api, "submitAssessment").mockResolvedValue(APTITUDE_RESULT);
    vi.spyOn(api, "getAssessmentResult").mockResolvedValue(APTITUDE_RESULT);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderApp("/assessments/aptitude");

    expect(await screen.findByText("Numerical")).toBeInTheDocument();
    await user.click(screen.getByLabelText(/A\. 3/));
    await user.click(screen.getByRole("button", { name: "Clear answer" }));
    await user.click(screen.getByLabelText(/B\. 4/));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(confirm).toHaveBeenCalled();
    expect(api.submitAssessment).toHaveBeenCalledWith("aptitude", 9, { AQ_1: "b", AQ_2: null });
    expect(await screen.findByText("50%")).toBeInTheDocument();
  });

  it("keeps answers when submitting fails, and can retry", async () => {
    vi.spyOn(api, "startAssessment").mockResolvedValue({ ...INTEREST_TEST, questions: INTEREST_TEST.questions.slice(0, 1) });
    vi.spyOn(api, "submitAssessment")
      .mockRejectedValueOnce(Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }))
      .mockResolvedValue(INTEREST_RESULT);
    vi.spyOn(api, "getAssessmentResult").mockResolvedValue(INTEREST_RESULT);
    const user = userEvent.setup();
    renderApp("/assessments/interest");
    await user.click(await screen.findByLabelText("Like"));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the server");
    expect(screen.getByLabelText("Like")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("IRA")).toBeInTheDocument();
  });

  it("start over asks for a fresh attempt", async () => {
    vi.spyOn(api, "startAssessment").mockResolvedValue(INTEREST_TEST);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderApp("/assessments/interest");
    await screen.findByRole("heading", { name: "Build things" });
    await user.click(screen.getByRole("button", { name: "Start over" }));
    await waitFor(() => expect(api.startAssessment).toHaveBeenLastCalledWith("interest", true));
  });

  it("unknown test kind and start errors are handled", async () => {
    renderApp("/assessments/astrology");
    expect(await screen.findByRole("heading", { name: "Test not found" })).toBeInTheDocument();
  });

  it("shows a retry screen if the test cannot start", async () => {
    vi.spyOn(api, "startAssessment").mockRejectedValueOnce(httpError(503, { detail: "Questions are not loaded yet." }))
      .mockResolvedValue(INTEREST_TEST);
    const user = userEvent.setup();
    renderApp("/assessments/interest");
    expect(await screen.findByRole("alert")).toHaveTextContent("not loaded");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Build things" })).toBeInTheDocument();
  });
});

describe("Result page", () => {
  it("shows interest code and score bars sorted high to low", async () => {
    vi.spyOn(api, "getAssessmentResult").mockResolvedValue(INTEREST_RESULT);
    renderApp("/assessments/interest/result");
    expect(await screen.findByText("IRA")).toBeInTheDocument();
    const bars = screen.getAllByRole("img");
    expect(bars[0]).toHaveAccessibleName(/Investigative.*100 out of 100/);
    expect(bars.at(-1)).toHaveAccessibleName(/Artistic.*25 out of 100/);
  });

  it("aptitude review shows mistakes with the correct answer and explanation", async () => {
    vi.spyOn(api, "getAssessmentResult").mockResolvedValue(APTITUDE_RESULT);
    const user = userEvent.setup();
    renderApp("/assessments/aptitude/result");
    expect(await screen.findByText("Opposite of hot?")).toBeInTheDocument();
    expect(screen.queryByText("2 + 2 = ?")).not.toBeInTheDocument(); // only mistakes by default
    expect(screen.getByText("Cold")).toBeInTheDocument();
    expect(screen.getByText("Cold is the opposite")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Show only mistakes and skipped"));
    expect(screen.getByText("2 + 2 = ?")).toBeInTheDocument();
  });

  it("shows a friendly page when there is no result yet", async () => {
    vi.spyOn(api, "getAssessmentResult").mockRejectedValue(httpError(404, { detail: "none" }));
    renderApp("/assessments/personality/result");
    expect(await screen.findByRole("heading", { name: "No result yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Take the test" })).toHaveAttribute("href", "/assessments/personality");
  });

  it("warns about careless personality answers", async () => {
    vi.spyOn(api, "getAssessmentResult").mockResolvedValue({
      kind: "personality", created_at: "2026-09-29T00:00:00Z",
      result: { consistency_warning: true, scales: [{ key: "openness", score: 50, band: "moderate", answered: 4 }] },
    });
    renderApp("/assessments/personality/result");
    expect(await screen.findByText(/agreed \(or disagreed\) with almost every statement/)).toBeInTheDocument();
  });
});
