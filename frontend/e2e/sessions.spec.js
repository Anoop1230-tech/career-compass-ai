import { expect, test } from "@playwright/test";

// Sessions and password reset against the real backend.
const newEmail = () => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const PASSWORD = "secret123";

test.beforeEach(async ({ page }, testInfo) => {
  const problems = [];
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/status of (400|401|404|409|422)/.test(msg.text())) problems.push(msg.text());
  });
  testInfo.problems = problems;
});

// oxlint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  expect(testInfo.problems, "browser errors").toEqual([]);
});

test("logging out makes a copied session cookie useless", async ({ page, browser }) => {
  await page.goto("/register");
  await page.getByLabel("Email").fill(newEmail());
  await page.getByLabel("Password", { exact: false }).first().fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Create your profile" })).toBeVisible();

  const cookies = await page.context().cookies();
  expect((await page.request.get("/api/auth/me")).status()).toBe(200);
  expect((await page.request.post("/api/auth/logout")).status()).toBe(204);

  // Another browser that copied the cookie before logout is signed out too
  const other = await browser.newContext();
  await other.addCookies(cookies);
  expect((await other.request.get("/api/auth/me")).status()).toBe(401);
  await other.close();
});

test("forgot password gives the same neutral answer for any email", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByLabel("Email").fill(newEmail());
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If an account exists for this email/)).toBeVisible();
});

test("reset page with an invalid link explains it and offers a new one", async ({ page }) => {
  await page.goto("/reset-password#token=this-token-does-not-exist-anywhere");
  await page.getByLabel(/^New password/).fill("newpass99");
  await page.getByLabel(/Repeat new password/).fill("newpass99");
  await page.getByRole("button", { name: "Save new password" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("invalid or has expired");
  await expect(alert.getByRole("link", { name: "Request a new link" })).toBeVisible();
});
