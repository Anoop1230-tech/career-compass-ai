import { expect, test } from "@playwright/test";

const ROUTES = [
  ["/", /where are you now/i],
  ["/next-steps", "Next Step Engine"],
  ["/explore", "Career Explorer"],
  ["/roadmap", "Career Roadmap"],
  ["/resources", "Exams, Colleges & Scholarships"],
  ["/mentor", "AI Career Mentor"],
  ["/assessments", "Assessments"],
  ["/profile", "Your Profile"],
  ["/no-such-page", "Page not found"],
];

// Fail any test that logs a browser error or throws an uncaught exception
test.beforeEach(async ({ page }, testInfo) => {
  const problems = [];
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(`console: ${msg.text()}`);
  });
  testInfo.problems = problems;
});

// Playwright requires an object pattern as the first argument
// oxlint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  expect(testInfo.problems, "browser console errors").toEqual([]);
});

test("frontend reaches backend through the proxy", async ({ page, request }) => {
  const api = await request.get("/api/health");
  expect(api.ok()).toBeTruthy();
  expect(await api.json()).toMatchObject({ status: "ok", database: "connected" });

  await page.goto("/");
  await expect(page.getByText("Server online")).toBeVisible();
});

for (const [path, heading] of ROUTES) {
  test(`page ${path} loads directly (refresh-safe)`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page).toHaveTitle("Career Compass AI");
  });
}

test("navigation works on desktop and mobile", async ({ page, isMobile }) => {
  await page.goto("/");
  const menuButton = page.getByRole("button", { name: "Open menu" });
  const nav = page.getByRole("navigation", { name: "Main" });

  if (isMobile) {
    await expect(nav).toBeHidden();
    await menuButton.click();
  } else {
    await expect(menuButton).toBeHidden();
  }

  await nav.getByRole("link", { name: "Roadmap" }).click();
  await expect(page).toHaveURL(/\/roadmap$/);
  await expect(page.getByRole("heading", { level: 1, name: "Career Roadmap" })).toBeVisible();
  if (isMobile) await expect(nav).toBeHidden(); // menu closed after navigating

  await page.getByRole("link", { name: "Career Compass AI home" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("home call-to-action opens next steps", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Find my next step" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Next Step Engine" })).toBeVisible();
});

test("no horizontal scrolling on any page", async ({ page }) => {
  for (const [path] of ROUTES) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
});

test("design rule: no gradients anywhere", async ({ page }) => {
  for (const [path] of ROUTES) {
    await page.goto(path);
    const gradients = await page.evaluate(() =>
      [...document.querySelectorAll("*")].filter((el) => getComputedStyle(el).backgroundImage.includes("gradient"))
        .length,
    );
    expect(gradients, `gradient found on ${path}`).toBe(0);
  }
});

test("keyboard users can skip to content", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard test is desktop only");
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("backend down: app shows offline status and does not crash", async ({ page }) => {
  // Simulate the API failing, without stopping the real server
  await page.route("**/api/health", (route) => route.abort("connectionrefused"));
  const problems = test.info().problems;

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Server offline")).toBeVisible();

  // The failed request itself logs a network error in the console: that one is expected
  problems.splice(0, problems.length, ...problems.filter((p) => !p.includes("Failed to load resource")));

  await page.unroute("**/api/health");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Server online")).toBeVisible();
});
