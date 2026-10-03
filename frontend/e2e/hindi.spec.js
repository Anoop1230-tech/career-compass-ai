import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The whole app in Hindi: accessibility, phone widths (Devanagari is taller and often longer than
// English), switching language and keeping the choice, and server messages in Hindi.
const hindi = async (page) => page.addInitScript(() => localStorage.setItem("cc-lang", "hi"));

const PUBLIC_PAGES = ["/", "/careers", "/careers/CAR_DATA_SCIENTIST", "/next-steps?stage=EDU_12_PCM", "/explore",
  "/dream-check?to=CAR_DATA_SCIENTIST&from_stage=EDU_12_PCM", "/roadmap?career=CAR_DATA_ANALYST", "/resources",
  "/resources?tab=colleges", "/compare?ids=CAR_DATA_SCIENTIST,CAR_DOCTOR_MBBS&stage=EDU_12_PCB", "/college-predictor?exam=EXM_JEE_MAIN&rank=12000&seat=OPEN", "/login", "/register", "/forgot-password", "/no-such-page"];
const PRIVATE_PAGES = ["/dashboard", "/for-you", "/next-steps", "/skill-gap?career=CAR_DATA_SCIENTIST",
  "/roadmap?career=CAR_ML_ENGINEER", "/assessments", "/assessments/interest", "/mentor", "/profile", "/profile/edit", "/profile/resume", "/report"];

async function signUp(page) {
  const email = `hi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`;
  expect((await page.request.post("/api/auth/register", { data: { email, password: "secret123" } })).ok()).toBeTruthy();
  expect((await page.request.put("/api/profile", { data: {
    full_name: "Asha Verma", current_stage: "ug_student",
    education: { degree: "B.Tech", branch: "Computer Science", year_of_study: 3 },
    skills: [{ name: "Python", level: "advanced" }], interests: ["technology"], goals: ["job"] } })).ok()).toBeTruthy();
  return email;
}

async function open(page, path) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
}

async function scan(page, path) {
  await open(page, path);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations.map((v) => `${path}: ${v.id} (${v.impact}) – ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`);
}

/** Sideways scroll, and Devanagari text whose line box is too tight (marks above/below get clipped). */
async function layoutProblems(page, path) {
  await open(page, path);
  return page.evaluate((where) => {
    const out = [];
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    if (overflow > 0) out.push(`${where}: sideways scroll ${overflow}px`);
    const devanagari = /[\u0900-\u097F]/;
    for (const el of document.querySelectorAll("h1, h2, h3, p, a, button, label, li, dt, dd, span.badge")) {
      if (!el.checkVisibility() || el.closest(".visually-hidden") || !devanagari.test(el.textContent)) continue;
      const style = getComputedStyle(el);
      const size = parseFloat(style.fontSize);
      const line = style.lineHeight === "normal" ? size * 1.2 : parseFloat(style.lineHeight);
      if (line / size < 1.3) out.push(`${where}: tight line-height ${(line / size).toFixed(2)} on ${el.tagName} "${el.textContent.trim().slice(0, 30)}"`);
      if (el.scrollWidth > el.clientWidth + 1 && style.overflow === "hidden") out.push(`${where}: text cut off in ${el.tagName}`);
    }
    return [...new Set(out)].slice(0, 10);
  }, path);
}

test("public pages in Hindi have no accessibility violations", async ({ page }) => {
  test.setTimeout(150_000);
  await hindi(page);
  const problems = [];
  for (const path of PUBLIC_PAGES) problems.push(...(await scan(page, path)));
  expect(problems).toEqual([]);
});

test("logged-in pages in Hindi have no accessibility violations", async ({ page }) => {
  test.setTimeout(150_000);
  await hindi(page);
  await signUp(page);
  const problems = [];
  for (const path of PRIVATE_PAGES) problems.push(...(await scan(page, path)));
  expect(problems).toEqual([]);
});

test("Hindi pages fit narrow phones and Devanagari has room to breathe", async ({ page, isMobile }) => {
  test.skip(isMobile, "sweeps its own widths");
  test.setTimeout(150_000);
  await hindi(page);
  await signUp(page);
  const problems = [];
  for (const width of [320, 360, 412]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ["/", "/careers", "/next-steps", "/for-you", "/skill-gap?career=CAR_DATA_SCIENTIST",
      "/roadmap?career=CAR_ML_ENGINEER", "/resources", "/assessments", "/profile/edit", "/profile/resume", "/mentor", "/compare?ids=CAR_SOFTWARE_ENGINEER,CAR_LAWYER,CAR_NURSE"]) {
      problems.push(...(await layoutProblems(page, path)).map((p) => `${width}px ${p}`));
    }
  }
  expect(problems).toEqual([]);
});

test("switching language translates the page and is remembered", async ({ page, isMobile }) => {
  await page.goto("/careers");
  await expect(page.getByRole("heading", { level: 1, name: "Careers" })).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: /menu/i }).first().click();
  await page.getByRole("radio", { name: "हिन्दी" }).check();
  await expect(page.getByRole("heading", { level: 1, name: "करियर" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "करियर" })).toBeVisible();
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/[\u0900-\u097F]/);
});

test("server messages are shown in Hindi", async ({ page }) => {
  await hindi(page);
  await page.goto("/login");
  await page.getByLabel(/ईमेल/).fill("nobody_here@example.com");
  await page.getByLabel(/पासवर्ड/).first().fill("Wrong12345");
  await page.locator("form").getByRole("button", { name: /लॉग इन/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "ईमेल या पासवर्ड गलत है।" })).toBeVisible();
});

test("catalog content in Hindi: career names and descriptions, English fallback for skills", async ({ page }) => {
  await hindi(page);
  await page.goto("/careers/CAR_DATA_SCIENTIST");
  await expect(page.getByRole("heading", { level: 1, name: "डेटा साइंटिस्ट" })).toBeVisible();
  await expect(page.getByText(/मशीन लर्निंग से सवालों के जवाब/)).toBeVisible();
  await expect(page.getByText("Python").first()).toBeVisible();
  await page.goto("/careers?q=वकील");
  await expect(page.getByRole("link", { name: /अधिवक्ता \(वकील\)/ }).first()).toBeVisible();
});