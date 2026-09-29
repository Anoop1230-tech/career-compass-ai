import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Automated accessibility check (WCAG 2.1 A and AA rules) on every page,
// as a visitor and as a logged-in user with a profile and test results.
const PUBLIC_PAGES = ["/", "/careers", "/careers/CAR_DATA_SCIENTIST", "/next-steps?stage=EDU_12_PCM", "/explore",
  "/dream-check?to=CAR_DATA_SCIENTIST&from_stage=EDU_12_PCM", "/roadmap?career=CAR_DATA_ANALYST", "/resources",
  "/resources?tab=colleges", "/resources?tab=scholarships", "/login", "/register", "/no-such-page"];
const PRIVATE_PAGES = ["/dashboard", "/for-you", "/next-steps", "/skill-gap?career=CAR_DATA_SCIENTIST", "/roadmap?career=CAR_ML_ENGINEER",
  "/assessments", "/assessments/interest", "/assessments/aptitude", "/mentor", "/profile", "/profile/edit"];

async function scan(page, path) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations.map((v) => `${path}: ${v.id} (${v.impact}) – ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`);
}

test("public pages have no accessibility violations", async ({ page }) => {
  test.setTimeout(120_000);
  const problems = [];
  for (const path of PUBLIC_PAGES) problems.push(...(await scan(page, path)));
  expect(problems).toEqual([]);
});

test("logged-in pages have no accessibility violations", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `a11y_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`;
  expect((await page.request.post("/api/auth/register", { data: { email, password: "secret123" } })).ok()).toBeTruthy();
  expect((await page.request.put("/api/profile", { data: {
    full_name: "Asha Verma", current_stage: "ug_student",
    education: { degree: "B.Tech", branch: "Computer Science", year_of_study: 3 },
    skills: [{ name: "Python", level: "advanced" }], interests: ["technology"], goals: ["job"] } })).ok()).toBeTruthy();
  await page.request.post("/api/mentor/chat", { data: { message: "Can I become a data scientist?" } });
  const problems = [];
  for (const path of PRIVATE_PAGES) problems.push(...(await scan(page, path)));
  expect(problems).toEqual([]);
});
