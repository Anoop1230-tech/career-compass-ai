import { expect, test } from "@playwright/test";

// Real backend + real datasets (the test server auto-loads datasets/*.csv).
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

test("browse, search and filter careers", async ({ page }) => {
  await page.goto("/careers");
  await expect(page.getByText("79 careers found")).toBeVisible();

  // Grouped by field, all on one page, in a fixed order
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 2 })).toHaveText([
    "Technology 24", "Healthcare 5", "Law 4", "Business 3", "Finance 2", "Government 3", "Defence 3", "Education 6",
    "Agriculture 3", "Creative Arts 18", "Vocational 3", "Skilled Trades 5"]);
  await expect(main.getByRole("heading", { level: 3 })).toHaveCount(79);
  await page.getByRole("navigation", { name: "Jump to a category" }).getByRole("link", { name: /Creative Arts/ }).click();
  await expect(page).toHaveURL(/#field-creative-arts$/);
  await expect(page.getByRole("heading", { level: 2, name: /Creative Arts/ })).toBeInViewport();

  await page.getByLabel("Search").fill("data");
  await expect(page).toHaveURL(/q=data/);
  await expect(page.getByRole("heading", { name: "Data Scientist" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Accountant" })).toBeHidden();

  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Field").selectOption("Government");
  await expect(page.getByText("3 careers found")).toBeVisible();

  // Filters survive a reload (they live in the URL)
  await page.reload();
  await expect(page.getByLabel("Field")).toHaveValue("Government");
  await expect(page.getByText("3 careers found")).toBeVisible();
});

test("career detail shows skills, paths and official links", async ({ page }) => {
  await page.goto("/careers?q=psu");
  await page.getByRole("link", { name: /PSU Engineer/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "PSU Engineer (Government)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Skills you need" })).toBeVisible();

  const gate = page.getByRole("link", { name: /^GATE/ }).first();
  await expect(gate).toHaveAttribute("href", "https://gate2027.iitm.ac.in/");
  await expect(gate).toHaveAttribute("target", "_blank");
  await expect(page.getByText(/always confirm on the/)).toBeVisible();
});

test("related careers link to each other", async ({ page }) => {
  await page.goto("/careers/CAR_DATA_ANALYST");
  await page.getByRole("link", { name: "Data Scientist" }).first().click();
  await expect(page).toHaveURL(/\/careers\/CAR_DATA_SCIENTIST$/);
  await expect(page.getByRole("heading", { level: 1, name: "Data Scientist" })).toBeVisible();
  await expect(page.getByText("Learn Python data stack")).toBeVisible(); // switching steps
  await page.getByRole("link", { name: "Careers", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Careers" })).toBeVisible();
});

test("unknown career shows a friendly 404", async ({ page }) => {
  await page.goto("/careers/CAR_DOES_NOT_EXIST");
  await expect(page.getByRole("heading", { name: "Career not found" })).toBeVisible();
});

test("every career page opens without errors", async ({ page, request, isMobile }) => {
  test.skip(isMobile, "one pass is enough; layout is covered by other tests");
  test.setTimeout(150_000);
  const list = await (await request.get("/api/catalog/careers?limit=100")).json();
  expect(list.total).toBe(79);
  for (const career of list.items) {
    await page.goto(`/careers/${career.career_id}`);
    await expect(page.getByRole("heading", { level: 1, name: career.name })).toBeVisible();
  }
});

test("careers pages have no sideways scrolling or gradients", async ({ page }) => {
  for (const path of ["/careers", "/careers/CAR_SOFTWARE_ENGINEER"]) {
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

test("new fields: a PCB student sees MBBS and the doctor page shows the NEET route", async ({ page }) => {
  await page.goto("/next-steps?stage=EDU_12_PCB");
  await expect(page.getByRole("heading", { name: /MBBS/ }).first()).toBeVisible();
  await page.goto("/careers/CAR_DOCTOR_MBBS");
  await expect(page.getByRole("heading", { level: 1, name: "Doctor (MBBS)" })).toBeVisible();
  await expect(page.getByText(/From MBBS/).first()).toBeVisible();
  await page.goto("/careers?domain=Skilled%20Trades");
  await expect(page.getByText("5 careers found")).toBeVisible();
});
test("compare careers from a career page", async ({ page }) => {
  await page.goto("/careers/CAR_DATA_SCIENTIST");
  await page.getByRole("link", { name: "Compare with others" }).click();
  await expect(page).toHaveURL(/\/compare\?ids=CAR_DATA_SCIENTIST$/);
  await page.getByLabel("Career 2").selectOption("CAR_DOCTOR_MBBS");
  await page.getByLabel("Starting from").selectOption("EDU_12_PCB");
  const table = page.getByRole("table", { name: /Comparison of Data Scientist, Doctor \(MBBS\)/ });
  await expect(table).toBeVisible();
  await expect(table.getByRole("link", { name: /NEET UG/ }).first()).toBeVisible();
  await expect(page).toHaveURL(/stage=EDU_12_PCB/);
  // Reload keeps the comparison (it lives in the URL)
  await page.reload();
  await expect(page.getByRole("table", { name: /Comparison of/ })).toBeVisible();
});