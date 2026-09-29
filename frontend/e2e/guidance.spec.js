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

test("a B.Tech student finds professional courses and creative careers", async ({ page }) => {
  await page.goto("/next-steps?stage=EDU_BTECH_CSE");
  await page.getByRole("button", { name: /Professional courses/ }).click();
  const group = page.getByRole("heading", { level: 2, name: "Professional courses" }).locator("..");
  await expect(group.getByRole("article")).toHaveCount(7);
  const performing = page.getByRole("article", { name: /Acting, stand-up comedy and anchoring/ });
  await expect(performing).toContainText("Stand-up Comedian");

  // Can I become a stand-up comedian from B.Tech? Yes, through a course, with no degree blocker
  await page.goto("/dream-check?to=CAR_STANDUP_COMEDIAN&from_stage=EDU_BTECH_CSE");
  await expect(page.getByRole("heading", { level: 2, name: "Yes – with a clear plan" })).toBeVisible();
  await expect(page.locator(".dream-result").getByText(/Professional course – Acting/).first()).toBeVisible();

  // The careers directory has the creative area, marked as needing no degree
  await page.goto("/careers?domain=Creative+Arts");
  await expect(page.getByText("18 careers found")).toBeVisible();
  await page.getByRole("link", { name: /Singer/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Singer" })).toBeVisible();
  await expect(page.getByText("No degree needed").first()).toBeVisible();
});

test("dream career checker uses the profile and explains the verdict", async ({ page }) => {
  await loginWithProfile(page);
  await page.goto("/next-steps");
  await page.getByRole("main").getByRole("link", { name: "Can I become…?" }).click();
  await page.getByLabel("Can I become").selectOption("CAR_DATA_SCIENTIST");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Yes – this is a direct route" })).toBeVisible();
  await expect(page.getByText("(from your profile)")).toBeVisible();
  await expect(page.getByRole("img", { name: /Skill readiness for Data Scientist/ })).toBeVisible();

  // A dream that needs a different base
  await page.goto("/dream-check?to=CAR_SOFTWARE_ENGINEER&from_stage=EDU_12_PCB");
  await expect(page.getByRole("heading", { level: 2, name: "Not directly from here" })).toBeVisible();
  await expect(page.getByText(/No recorded study route from Class 12/)).toBeVisible();
});

test("roadmap: set a target, tick a skill, and it is remembered", async ({ page }) => {
  await loginWithProfile(page);
  await page.goto("/roadmap");
  await page.getByLabel("Target career").selectOption("CAR_DATA_SCIENTIST");
  await expect(page.getByRole("heading", { level: 1, name: "Roadmap: Data Scientist" })).toBeVisible();
  await expect(page.getByText(/Skipped because you already have them: .*Python/)).toBeVisible();
  await page.getByRole("button", { name: "Set as my target" }).click();
  await expect(page.getByText("Your target career")).toBeVisible();
  const box = page.getByRole("checkbox").first();
  await box.check();
  await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();

  // /roadmap now opens the saved target with the saved progress
  await page.goto("/roadmap");
  await expect(page.getByRole("heading", { level: 1, name: "Roadmap: Data Scientist" })).toBeVisible();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
});

test("explorer expands from class 10 to careers", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { level: 2, name: "Class 10" })).toBeVisible();
  await page.getByRole("button", { name: "Expand Class 12 – Science (PCM)" }).click();
  const pcm = page.getByRole("list", { name: "Options after Class 12 – Science (PCM)" });
  await pcm.getByRole("button", { name: "Expand B.Tech – Computer Science" }).click();
  const btech = page.getByRole("list", { name: "Options after B.Tech – Computer Science" });
  await expect(btech.getByRole("link", { name: "Software Engineer" })).toBeVisible();
  await btech.getByRole("button", { name: "Expand Software Engineer" }).click();
  await expect(page.getByRole("list", { name: "Options after Software Engineer" }).getByText("Backend Developer")).toBeVisible();
});

test("exams, colleges and scholarships with filters", async ({ page }) => {
  await loginWithProfile(page);
  await page.goto("/resources");
  await expect(page.getByRole("heading", { level: 3, name: "GATE" })).toBeVisible();
  await page.getByLabel("Only for my stage").click();
  await expect(page.getByLabel("Only for my stage")).toBeChecked();
  await expect(page).toHaveURL(/mine=1/);
  await expect(page.getByRole("heading", { level: 3, name: "JEE Main" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 3, name: "GATE" })).toBeVisible();

  await page.getByRole("button", { name: "Colleges" }).click();
  await page.getByLabel("State").selectOption("Tamil Nadu");
  await expect(page.getByRole("heading", { level: 3, name: /Tiruchirappalli/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: /Bombay/ })).toHaveCount(0);
  await page.getByLabel("Search").fill("guindy");
  await expect(page.getByText("1 result")).toBeVisible();

  await page.getByRole("button", { name: "Scholarships" }).click();
  await page.getByLabel("Only for my stage").click();
  await expect(page.getByLabel("Only for my stage")).toBeChecked();
  await expect(page.getByRole("heading", { level: 3, name: "AICTE Pragati Scholarship for Girl Students" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Prime Minister's Research Fellowship" })).toHaveCount(0);
});

test("mentor answers from the profile and remembers the conversation", async ({ page }) => {
  await loginWithProfile(page);
  await page.goto("/mentor");
  const log = page.getByRole("list", { name: "Conversation" });
  await page.getByLabel("Your question").fill("Can I become a data scientist?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(log.getByText(/direct route/)).toBeVisible();
  await expect(log.getByRole("link", { name: "Full dream check" })).toBeVisible();

  // Follow-up without naming the career
  await page.getByLabel("Your question").fill("what skills should I learn first?");
  await page.keyboard.press("Enter");
  await expect(log.getByText(/For Data Scientist you are about \d+% ready/)).toBeVisible();

  // Suggestion chip, then reload keeps history
  await page.getByRole("button", { name: /^Roadmap for Data Scientist$/ }).click();
  await expect(log.getByText("Your roadmap to Data Scientist:", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("list", { name: "Conversation" }).getByText("Can I become a data scientist?")).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Clear conversation" }).click();
  await expect(page.getByText(/Ask me anything/)).toBeVisible();
});
