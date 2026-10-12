import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_PASSWORD ?? "vertigo123";
const stamp = Date.now().toString(36);

// Each run uses its own window in 2032 (npm run db:clean-tests removes the projects).
const base = Date.UTC(2032, 0, 1) + (Date.now() % 300) * 86_400_000;
const day = (n: number) => new Date(base + n * 86_400_000).toISOString().slice(0, 10);
const dmy = (iso: string) => iso.split("-").reverse().join(".");

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("production plans", () => {
  test("plan from a template, schedule, tasks, day sheet and share link", async ({ page, browser }) => {
    page.on("dialog", (d) => d.accept());
    await signIn(page, "admin@vertigo.test");

    await page.goto("/projects/new");
    await page.getByLabel("Name", { exact: true }).fill(`E2E show ${stamp}`);
    await page.getByLabel("Status").selectOption("confirmed");
    await page.getByLabel("Load-in").fill(`${day(1)}T08:00`);
    await page.getByLabel("Show start").fill(`${day(2)}T21:00`);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `E2E show ${stamp}` })).toBeVisible();

    // From the project page: create the plan from the seeded template, anchored on load-in.
    await page.getByRole("button", { name: "Create plan" }).click();
    const templateSelect = page.getByLabel("Template");
    await templateSelect.selectOption((await templateSelect.locator("option", { hasText: "Festival laser show" }).first().getAttribute("value"))!);
    await expect(page.getByLabel("Anchor day")).toHaveValue(day(1));
    await page.getByRole("dialog").getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.getByText("Rig truss and hang fixtures")).toBeVisible();
    await expect(page.getByText(dmy(day(2))).first()).toBeVisible();

    // Add a schedule entry on the show day.
    await page.getByRole("button", { name: "Add entry" }).click();
    await page.getByLabel("What").fill(`Laser check ${stamp}`);
    await page.getByLabel("Day", { exact: true }).fill(day(2));
    await page.getByLabel("Time").fill("18:30");
    await page.getByLabel("Duration (min)").fill("30");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(`Laser check ${stamp}`)).toBeVisible();
    await expect(page.getByText("18:30–19:00")).toBeVisible();

    // Tick a task.
    await expect(page.getByText("0 / 8 done")).toBeVisible();
    const bookVan = page.getByRole("listitem").filter({ hasText: "Book van" });
    await bookVan.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("1 / 8 done")).toBeVisible();

    // PDFs.
    const url = page.url();
    const planId = (await page.locator('a[href*="/plan.pdf"]').first().getAttribute("href"))!.match(/\/api\/plans\/([^/]+)\//)![1];
    for (const q of ["", `?day=${day(2)}`]) {
      const res = await page.request.get(`/api/plans/${planId}/plan.pdf${q}`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("application/pdf");
    }

    // Share link works without login.
    await page.getByRole("button", { name: "Create share link" }).click();
    const shareUrl = (await page.locator("code").first().textContent())!.trim();
    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto(shareUrl);
    await expect(anonPage).not.toHaveURL(/\/login/);
    await expect(anonPage.getByRole("heading", { name: `E2E show ${stamp}` })).toBeVisible();
    await expect(anonPage.getByText(`Laser check ${stamp}`)).toBeVisible();
    expect((await anonPage.request.get(`/api/plans/${planId}/plan.pdf`)).status()).toBe(401);
    expect((await anonPage.request.get(`/api/plans/${planId}/plan.pdf?share=${shareUrl.split("/").pop()}`)).status()).toBe(200);
    await anon.close();

    await page.goto(url);
    await page.getByRole("button", { name: "Revoke link" }).click();
    await expect(page.getByRole("button", { name: "Create share link" })).toBeVisible();
  });
});
