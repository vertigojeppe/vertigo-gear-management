import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

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

  test("documents: chunked upload, versions, markup", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await signIn(page, "admin@vertigo.test");
    await page.goto("/projects/new");
    await page.getByLabel("Name", { exact: true }).fill(`E2E show ${stamp} docs`);
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("button", { name: "Create plan" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/plan$/);
    const planUrl = page.url();

    // A PNG, uploaded through the chunked uploader.
    const png = await sharp({ create: { width: 320, height: 200, channels: 3, background: "#dde3ea" } }).png().toBuffer();
    const name = `plot-${stamp}.png`;
    await page.getByLabel("Upload files").setInputFiles({ name, mimeType: "image/png", buffer: png });
    await expect(page.getByText("uploaded").first()).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
    await expect(page.getByText("Version 1")).toBeVisible();

    // Same name again → version 2.
    await page.getByLabel("Upload files").setInputFiles({ name, mimeType: "image/png", buffer: png });
    await expect(page.getByText("Version 2")).toBeVisible();

    // Open it, draw a box, save, reload: the box is still there.
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await page.getByRole("button", { name: "Box" }).click();
    const layer = page.getByLabel("markup");
    const box = (await layer.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 5 });
    await page.mouse.up();
    await expect(layer.locator("[data-shape=rect]")).toHaveCount(1);
    await page.getByRole("button", { name: "Save markup" }).click();
    await expect(page.getByText("Markup saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("markup").locator("[data-shape=rect]")).toHaveCount(1);
    await expect(page.getByText("has markup")).toBeVisible();

    // The plan PDF still renders with the document in it.
    await page.goto(planUrl);
    const pdfHref = (await page.locator('a[href*="/plan.pdf"]').first().getAttribute("href")) ?? "";
    const planId = pdfHref.match(/\/api\/plans\/([^/]+)\//)?.[1];
    if (planId) expect((await page.request.get(`/api/plans/${planId}/plan.pdf`)).status()).toBe(200);

    // A PDF document opens in the page viewer.
    const pdfBytes = await (await page.request.get(`/api/plans/${planId}/plan.pdf`)).body();
    await page.getByLabel("Upload files").setInputFiles({ name: `rider-${stamp}.pdf`, mimeType: "application/pdf", buffer: pdfBytes });
    await page.getByRole("link", { name: new RegExp(`rider-${stamp}.pdf`) }).click();
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible({ timeout: 15000 });
    await expect(page.locator("canvas")).toBeVisible();

    // An STL opens in the 3D viewer.
    const tri = (a: number[], b: number[], c: number[]) =>
      `facet normal 0 0 1\n outer loop\n  vertex ${a.join(" ")}\n  vertex ${b.join(" ")}\n  vertex ${c.join(" ")}\n endloop\nendfacet\n`;
    const stl = Buffer.from("solid cube\n" + tri([0, 0, 0], [1, 0, 0], [1, 1, 0]) + tri([0, 0, 0], [1, 1, 0], [0, 1, 0]) + tri([0, 0, 1], [1, 1, 1], [1, 0, 1]) + "endsolid cube\n");
    await page.goto(planUrl);
    await page.getByLabel("Upload files").setInputFiles({ name: `cube-${stamp}.stl`, mimeType: "model/stl", buffer: stl });
    await page.getByRole("link", { name: new RegExp(`cube-${stamp}.stl`) }).click();
    await expect(page.getByRole("button", { name: "Measure" })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Could not load the model.")).toHaveCount(0);
  });
});
