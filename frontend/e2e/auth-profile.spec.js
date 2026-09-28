import { expect, test } from "@playwright/test";

// Unique email per test so parallel tests never collide
const newEmail = () => `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const PASSWORD = "secret123";

// Fail any test that throws in the page. 401/404/409 responses are expected
// here (logged-out checks, new profile), so those console lines are allowed.
test.beforeEach(async ({ page }, testInfo) => {
  const problems = [];
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/status of (401|404|409|422)/.test(msg.text())) problems.push(msg.text());
  });
  testInfo.problems = problems;
});

// oxlint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  expect(testInfo.problems, "browser errors").toEqual([]);
});

async function openMenuIfMobile(page, isMobile) {
  if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
}

async function register(page, email = newEmail()) {
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: false }).first().fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Create your profile" })).toBeVisible();
  return email;
}

test("full journey: register, build profile, reload, log out, log in", async ({ page, isMobile }) => {
  const email = await register(page);

  // Step 1: about you
  await page.getByLabel(/Full name/).fill("Asha Verma");
  await page.getByLabel(/Where are you now/).selectOption("ug_student");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2: education
  await page.getByLabel(/Highest \/ current degree/).fill("B.Tech");
  await page.getByLabel(/Branch/).fill("Computer Science");
  await page.getByLabel(/Score type/).selectOption("cgpa_10");
  await page.getByLabel(/Academic score/).fill("8.4");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3: skills
  await page.getByRole("button", { name: "+ Add skill" }).click();
  await page.getByLabel(/^Skill/).fill("Python");
  await page.getByLabel(/^Level/).selectOption("advanced");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4: experience
  await page.getByRole("button", { name: "+ Add project" }).click();
  await page.getByLabel(/Project title/).fill("Movie recommender");
  await page.getByLabel(/Technologies/).fill("Python, Pandas");
  await page.getByLabel(/^Link/).fill("https://github.com/example/movies");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 5: interests and goals
  await page.getByText("Technology", { exact: true }).click();
  await page.getByText("Higher studies", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 6: preferences
  await page.getByLabel(/Preferred work mode/).selectOption("hybrid");
  await page.getByRole("button", { name: "Save profile" }).click();

  // Summary
  await expect(page.getByRole("heading", { level: 1, name: "Asha Verma" })).toBeVisible();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await expect(page.getByText("Python · Advanced")).toBeVisible();
  await expect(page.getByRole("link", { name: "Movie recommender" })).toHaveAttribute(
    "href",
    "https://github.com/example/movies",
  );

  // Data survives a full reload (it came from the database, not memory)
  await page.reload();
  await expect(page.getByText("Computer Science")).toBeVisible();
  await expect(page.getByText("8.4 (CGPA (out of 10))")).toBeVisible();

  // Log out from the header
  await openMenuIfMobile(page, isMobile);
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();

  // Log back in: returns to the profile
  await page.getByLabel("Email").fill(email.toUpperCase());
  await page.getByLabel("Password", { exact: false }).first().fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Asha Verma" })).toBeVisible();
  // Log out from the profile page button too: must land on home, not /login
  await page.getByRole("main").getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: /where are you now/i })).toBeVisible();
});

test("edit an existing profile", async ({ page }) => {
  await register(page);
  await page.getByLabel(/Full name/).fill("Ravi Kumar");
  await page.getByLabel(/Where are you now/).selectOption("class_10");
  await page.getByRole("button", { name: "Save now" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ravi Kumar" })).toBeVisible();

  await page.getByRole("link", { name: "Edit profile" }).click();
  await expect(page.getByLabel(/Full name/)).toHaveValue("Ravi Kumar");
  await page.getByRole("button", { name: /2\. Education/ }).click();
  await page.getByLabel(/Stream/).selectOption("pcm");
  await page.getByRole("button", { name: "Save now" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ravi Kumar" })).toBeVisible();
  await expect(page.getByText("Science – PCM", { exact: true })).toBeVisible();
});

test("wrong password and duplicate email show clear messages", async ({ page }) => {
  const email = await register(page);
  await page.context().clearCookies();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: false }).first().fill("wrong999");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Incorrect email or password.");

  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: false }).first().fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");
});

test("invalid score is caught before saving", async ({ page }) => {
  await register(page);
  await page.getByLabel(/Full name/).fill("Asha");
  await page.getByLabel(/Where are you now/).selectOption("ug_student");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/Score type/).selectOption("cgpa_10");
  await page.getByLabel(/Academic score/).fill("12");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter a number from 0 to 10.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Education" })).toBeVisible();
});

test("login cookie is httpOnly (JavaScript cannot read it)", async ({ page }) => {
  await register(page);
  expect(await page.evaluate(() => document.cookie)).not.toContain("cc_session");
  const cookie = (await page.context().cookies()).find((c) => c.name === "cc_session");
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/api" });
});

test("logged-out users cannot open profile pages", async ({ page }) => {
  for (const path of ["/profile", "/profile/edit"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  }
});

test("delete profile keeps the account", async ({ page }) => {
  await register(page);
  await page.getByLabel(/Full name/).fill("Temp User");
  await page.getByLabel(/Where are you now/).selectOption("job_seeker");
  await page.getByRole("button", { name: "Save now" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Temp User" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete profile" }).click();
  await expect(page.getByRole("heading", { name: "Create your profile" })).toBeVisible();
});
