import { expect, test } from "@playwright/test";

const ROUTES = [
  ["/", /where are you now/i],
  ["/next-steps", "Next steps"],
  ["/explore", "Career explorer"],
  ["/careers", "Careers"],
  ["/roadmap", "Career roadmap"],
  ["/resources", "Exams, colleges and scholarships"],
  ["/mentor", "Log in"], // login required
  ["/dashboard", "Log in"], // login required
  ["/login", "Log in"],
  ["/register", "Create your account"],
  ["/no-such-page", "Page not found"],
];

// Fail any test that logs a browser error or throws an uncaught exception
test.beforeEach(async ({ page }, testInfo) => {
  const problems = [];
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("status of 401")) problems.push(`console: ${msg.text()}`);
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
  await expect(page.getByRole("heading", { level: 1, name: "Next steps" })).toBeVisible();
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



// The app shell is a sidebar on wide screens and a top bar + drawer on narrow ones.
// At every width: each visible shell item stays on one line and inside the shell,
// and the page never scrolls sideways.
async function checkShell(page, width) {
  await page.setViewportSize({ width, height: 800 });
  const result = await page.evaluate(() => {
    const shell = document.querySelector(".header");
    const box = shell.getBoundingClientRect();
    const visible = (el) => el.checkVisibility({ checkVisibilityCSS: true }) && el.getBoundingClientRect().width > 0;
    const items = [...shell.querySelectorAll(".brand, .nav__link, .btn, .menu-toggle")].filter(visible);
    return {
      wrapped: items
        .filter((el) => el.getBoundingClientRect().height > (parseFloat(getComputedStyle(el).lineHeight) || 20) * 1.8 + 20)
        .map((el) => el.textContent.trim()),
      cutOff: items.filter((el) => el.getBoundingClientRect().right > Math.min(box.right, innerWidth) + 1)
        .map((el) => el.textContent.trim() || el.className),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sidebar: getComputedStyle(shell).position === "fixed",
    };
  });
  expect(result.wrapped, `wrapped at ${width}px`).toEqual([]);
  expect(result.cutOff, `cut off at ${width}px`).toEqual([]);
  expect(result.overflow, `sideways scroll at ${width}px`).toBeLessThanOrEqual(0);
  expect(result.sidebar, `sidebar at ${width}px`).toBe(width >= 1024);
}

const WIDTHS = [1920, 1440, 1366, 1280, 1024, 1023, 900, 768];

test("app shell fits at every width (logged out)", async ({ page, isMobile }) => {
  test.skip(isMobile, "width sweep is desktop only");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Get started", exact: true })).toBeAttached();
  for (const width of WIDTHS) await checkShell(page, width);
});

test("app shell fits at every width (logged in, long email)", async ({ page, isMobile }) => {
  test.skip(isMobile, "width sweep is desktop only");
  const email = `a_very_long_header_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`;
  const registered = await page.request.post("/api/auth/register", { data: { email, password: "secret123" } });
  expect(registered.ok()).toBeTruthy();
  await page.goto("/careers");
  await expect(page.getByRole("button", { name: "Log out" })).toBeAttached();
  for (const width of WIDTHS) await checkShell(page, width);
});

test("mobile drawer opens over the page and closes with the backdrop", async ({ page, isMobile }) => {
  test.skip(!isMobile, "drawer is the mobile menu");
  await page.goto("/careers");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("group", { name: "Your journey" })).toBeVisible();
  // the drawer covers the left side; tap the dimmed area on the right
  const { width } = page.viewportSize();
  await page.mouse.click(width - 10, 400);
  await expect(nav).toBeHidden();
  await expect(page).toHaveURL(/\/careers$/);
});
