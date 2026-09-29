import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Themes: every theme must pass the same WCAG checks (colour contrast matters most),
// the choice must be saved, and the saved theme must apply before the first paint.
const PAGES = ["/", "/careers", "/careers/CAR_SINGER", "/next-steps?stage=EDU_BTECH_CSE", "/explore",
  "/dream-check?to=CAR_DATA_SCIENTIST&from_stage=EDU_12_PCM", "/resources", "/login"];

for (const theme of ["dark", "contrast"]) {
  test(`${theme} theme has no accessibility violations`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript((t) => localStorage.setItem("cc-theme", t), theme);
    const problems = [];
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      problems.push(...violations.map((v) => `${path}: ${v.id} – ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`));
    }
    expect(problems).toEqual([]);
  });
}

test("the theme picker switches, saves and restores the theme", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
  const picker = page.getByRole("group", { name: /Theme/ });
  await picker.getByRole("radio", { name: "Dark" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(18, 23, 21)");

  // Saved: a reload starts dark straight away (set by theme-init.js before React runs)
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();

  await page.getByRole("radio", { name: "High contrast" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "contrast");
});

test("match device follows the system dark mode setting", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/careers");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("content below the fold reveals when scrolled to, and nothing stays hidden", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(await page.locator(".reveal").count()).toBeGreaterThan(0); // blocks below the fold wait for scrolling
  // Scroll down the whole page like a reader would
  for (let i = 0; i < 30; i += 1) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(60);
  }
  await expect(page.locator(".cta-band")).toHaveCSS("opacity", "1");
  await expect(page.locator(".reveal:not(.is-visible)")).toHaveCount(0);
});

test("with reduced motion nothing is hidden or animated", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(await page.locator(".reveal").count()).toBe(0);
  const duration = await page.locator(".hero-art__cloud").first().evaluate((el) => getComputedStyle(el).animationDuration);
  expect(parseFloat(duration)).toBeLessThan(0.01);
});
