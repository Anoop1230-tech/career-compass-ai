import { expect, test } from "@playwright/test";

const PASSWORD = "secret123";
const newEmail = () => `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;

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

async function registerAndOpen(page, path) {
  await page.goto("/register");
  await page.getByLabel("Email").fill(newEmail());
  await page.getByLabel("Password", { exact: false }).first().fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Create your profile" })).toBeVisible();
  await page.goto(path);
}

test("take the interest test end to end", async ({ page }) => {
  test.setTimeout(90_000);
  await registerAndOpen(page, "/assessments");
  await page.getByRole("heading", { name: "Interest profile" }).locator("..").getByRole("link", { name: "Start" }).click();

  // 36 questions: prefer investigative-sounding items to get a predictable top type
  for (let i = 0; i < 36; i += 1) {
    await expect(page.getByText(`Question ${i + 1} of 36`)).toBeVisible();
    const text = await page.getByRole("heading", { level: 1 }).innerText();
    const likes = /problem|data|research|experiment|why|debug/i.test(text);
    await page.getByLabel(likes ? "Strongly like" : "Dislike", { exact: true }).click();
  }
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Interest profile" })).toBeVisible();
  await expect(page.getByText(/^I/).first()).toBeVisible();
  await expect(page.getByText("Investigative").first()).toBeVisible();

  // The hub now shows it as completed
  await page.getByRole("link", { name: "All tests" }).click();
  const card = page.getByRole("heading", { name: "Interest profile" }).locator("..");
  await expect(card.getByText("Completed")).toBeVisible();
  await expect(card.getByRole("link", { name: "View result" })).toBeVisible();
});

test("aptitude: answers are hidden, progress survives reload, review after submit", async ({ page }) => {
  test.setTimeout(90_000);
  await registerAndOpen(page, "/assessments/aptitude");
  await expect(page.getByText("Question 1 of 40")).toBeVisible();

  // The page source/state must not contain answers or explanations
  const startResponse = await page.request.post("/api/assessments/aptitude/start");
  const body = await startResponse.text();
  expect(body).not.toContain("correct_option");
  expect(body).not.toContain("explanation");

  // Answer two questions, then reload: they must still be there
  const answers = page.getByRole("main").getByRole("radio"); // not the theme picker in the menu
  await answers.first().check({ force: true });
  await page.getByRole("button", { name: "Next" }).click();
  await answers.nth(1).check({ force: true });
  await expect(page.getByText("2 answered")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Question 2 of 40 · 2 answered")).toBeVisible();

  // Skip to the end and submit with blanks (confirm dialog)
  // Move to the last question (the button says "Next" on answered ones, "Skip" on blank ones)
  for (let i = 1; i < 39; i += 1) await page.getByRole("button", { name: /^(Next|Skip)$/ }).click();
  await expect(page.getByText("Question 40 of 40")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByText(/of 40 correct/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review answers" })).toBeVisible();
  await expect(page.getByText("Skipped").first()).toBeVisible();
  await expect(page.getByText(/Correct answer:/).first()).toBeVisible();
});

test("personality test blocks submit until everything is answered", async ({ page }) => {
  await registerAndOpen(page, "/assessments/personality");
  await expect(page.getByText("Question 1 of 30")).toBeVisible();
  for (let i = 0; i < 29; i += 1) await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("alert")).toContainText("30 left");
  await expect(page.getByText("Question 1 of 30")).toBeVisible();
});

test("assessments need login", async ({ page }) => {
  await page.goto("/assessments/interest");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});

test("assessment pages have no sideways scroll or gradients", async ({ page }) => {
  await registerAndOpen(page, "/assessments");
  for (const path of ["/assessments", "/assessments/aptitude", "/assessments/interest/result"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
    const gradients = await page.evaluate(() =>
      [...document.querySelectorAll("*")].filter((el) => getComputedStyle(el).backgroundImage.includes("gradient")).length,
    );
    expect(gradients, path).toBe(0);
  }
});
