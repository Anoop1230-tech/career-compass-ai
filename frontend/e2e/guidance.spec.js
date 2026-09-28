import { expect, test } from "@playwright/test";

// Browser tests for the guidance pages (next steps, recommendations, roadmap, ...).
const PASSWORD = "secret123";
const newEmail = () => `guide_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;

export const PROFILE = {
  full_name: "Asha Verma",
  current_stage: "ug_student",
  education: { degree: "B.Tech", branch: "Computer Science", year_of_study: 3 },
  skills: [
    { name: "Python", category: "programming", level: "advanced" },
    { name: "SQL", category: "technical", level: "intermediate" },
    { name: "Statistics", category: "technical", level: "intermediate" },
  ],
  interests: ["technology", "research"],
  goals: ["job", "higher_studies"],
};

test.beforeEach(async ({ page }, testInfo) => {
  const problems = [];
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/status of (401|404)/.test(msg.text())) problems.push(msg.text());
  });
  testInfo.problems = problems;
});

// oxlint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  expect(testInfo.problems, "browser errors").toEqual([]);
});

/** Registers through the UI, then saves a profile through the API (same cookies). */
async function loginWithProfile(page, profile = PROFILE) {
  await page.goto("/register");
  await page.getByLabel("Email").fill(newEmail());
  await page.getByLabel("Password", { exact: false }).first().fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Create your profile" })).toBeVisible();
  if (profile) {
    const response = await page.request.put("/api/profile", { data: profile });
    expect(response.ok()).toBeTruthy();
  }
}

test("visitor picks a stage and sees next steps", async ({ page }) => {
  await page.goto("/next-steps");
  await expect(page.getByText("Choose your current stage above")).toBeVisible();
  await page.getByLabel("Where are you now?").selectOption("EDU_12_PCM");
  await expect(page).toHaveURL(/stage=EDU_12_PCM/);
  await expect(page.getByRole("heading", { level: 2, name: "Class 12 – Science (PCM)" })).toBeVisible();
  const btech = page.getByRole("article", { name: "B.Tech – Computer Science" });
  await expect(btech).toBeVisible();
  await expect(btech.getByRole("link", { name: /JEE Main/ })).toHaveAttribute("href", "https://jeemain.nta.nic.in/");
  await expect(btech.getByText(/Next action:/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();

  // Filter tabs
  await page.getByRole("button", { name: /Study further/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Study further" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Exams" })).toHaveCount(0);
});

test("logged-in user starts from their profile stage", async ({ page }) => {
  await loginWithProfile(page);
  await page.goto("/next-steps");
  await expect(page.getByLabel("Where are you now?")).toHaveValue("EDU_BTECH_CSE");
  await expect(page.getByText("From your profile: B.Tech in computer science.")).toBeVisible();
  // Goal "higher studies" puts study options first, with the reason shown
  const first = page.locator(".option-card").first();
  await expect(first.locator(".option-card__why")).toContainText("you want higher studies");
  // Career cards show skill coverage and link to the career page
  const ds = page.getByRole("article", { name: "Data Scientist" });
  await expect(ds.getByRole("img", { name: /Skills you have for Data Scientist/ })).toBeVisible();
  await ds.getByRole("link", { name: "Data Scientist" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Data Scientist" })).toBeVisible();

  // Exploring another stage and coming back
  await page.goto("/next-steps?stage=EDU_BCA");
  await expect(page.getByRole("heading", { level: 2, name: "BCA" })).toBeVisible();
  await page.getByRole("button", { name: "Back to my stage" }).click();
  await expect(page.getByLabel("Where are you now?")).toHaveValue("EDU_BTECH_CSE");
});

test("recommendations are ranked and explained", async ({ page }) => {
  await loginWithProfile(page);
  await page.goto("/for-you");
  await expect(page.getByRole("heading", { level: 1, name: "Careers for you" })).toBeVisible();
  await expect(page.getByText(/Confidence: \d+%/)).toBeVisible();
  const cards = page.locator(".rec-card");
  await expect(cards.first()).toBeVisible();
  const scores = await page.locator(".rec-card__score strong").allInnerTexts();
  const numbers = scores.map(Number);
  expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
  await cards.first().getByRole("button", { name: "How this score was made" }).click();
  await expect(cards.first().getByText("weight 22%").first()).toBeVisible();
  await page.getByLabel("Area").selectOption("Finance");
  await expect(page).toHaveURL(/domain=Finance/);
  await expect(page.locator(".rec-card").first()).toContainText("Finance");
});

test("skill gap from a career page", async ({ page }) => {
  await loginWithProfile(page);
  await page.goto("/careers/CAR_DATA_SCIENTIST");
  await page.getByRole("link", { name: "Check my skill gap" }).click();
  await expect(page).toHaveURL(/skill-gap\?career=CAR_DATA_SCIENTIST/);
  await expect(page.getByText("Readiness for Data Scientist")).toBeVisible();
  await expect(page.getByRole("table", { name: /Core skills to learn/ })).toBeVisible();
  await expect(page.getByText(/Python · advanced/)).toBeVisible();
  await page.getByLabel("Target career").selectOption("CAR_ACCOUNTANT");
  await expect(page.getByText("Readiness for Accountant")).toBeVisible();
});
