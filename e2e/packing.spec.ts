import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_PASSWORD ?? "vertigo123";
const stamp = Date.now().toString(36);

// Each run uses its own window in 2032 so leftovers from earlier runs never
// compete for the same gear. (npm run db:clean-tests removes them.)
const base = Date.UTC(2032, 0, 1) + (Date.now() % 300) * 86_400_000;
const day = (n: number) => new Date(base + n * 86_400_000).toISOString().slice(0, 10);

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function pickOption(page: Page, label: string | RegExp, text: string) {
  const select = page.getByLabel(label);
  const value = await select.locator("option", { hasText: text }).first().getAttribute("value");
  await select.selectOption(value!);
}

test.describe("packing lists", () => {
  test("pack, check out, share, check in", async ({ page, browser }) => {
    page.on("dialog", (d) => d.accept());
    await signIn(page, "admin@vertigo.test");

    // A project of our own so the seeded ones stay untouched.
    await page.goto("/projects/new");
    await page.getByLabel("Name").fill(`E2E show ${stamp}`);
    await pickOption(page, "Client", "Vega");
    await page.getByLabel("Status").selectOption("confirmed");
    await page.getByLabel("Prep start").fill(day(0));
    await page.getByLabel(/^Return/).fill(day(2));
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `E2E show ${stamp}` })).toBeVisible();
    const projectUrl = page.url();

    // Empty list, then one unit of a seeded model.
    await page.getByRole("link", { name: "New packing list" }).click();
    await page.getByLabel("Name").fill(`Truck ${stamp}`);
    await page.getByLabel("Start from").selectOption("empty");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `Truck ${stamp}` })).toBeVisible();
    await expect(page.getByText("Nothing on the list yet")).toBeVisible();
    const listUrl = page.url();
    const listId = listUrl.split("/").pop()!;

    await page.getByRole("button", { name: "Add gear" }).click();
    await pickOption(page, "Model", "Martin MAC Aura XB");
    await page.getByLabel("Quantity").fill("1");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("link", { name: "Martin MAC Aura XB" })).toBeVisible();

    // Packing mode: unknown tag is reported, choosing a unit ticks it.
    await page.getByRole("link", { name: "Pack", exact: true }).click();
    await expect(page.getByText("0 / 1 packed")).toBeVisible();
    await page.getByLabel("Scan or type a tag").fill("VG-999999");
    await page.getByRole("button", { name: "Scan", exact: true }).click();
    await expect(page.getByText("No item with tag VG-999999.")).toBeVisible();
    await page.getByRole("button", { name: "Tick unit" }).click();
    await expect(page.getByText("1 / 1 packed")).toBeVisible();
    await expect(page.getByText("Everything is packed.").first()).toBeVisible();

    // Check out.
    await page.goto(listUrl);
    await page.getByRole("button", { name: "Check out" }).click();
    await expect(page.getByText("Checked out", { exact: true })).toBeVisible();
    await expect(page.getByText("0 / 1 back").first()).toBeVisible();

    // PDF for a signed-in user, and the share link for anyone.
    const pdf = await page.request.get(`/api/packing/${listId}/list.pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");

    await page.getByRole("button", { name: "Create share link" }).click();
    const shareUrl = (await page.locator("code").first().textContent())!.trim();
    expect(shareUrl).toContain("/share/packing/");
    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto(shareUrl);
    await expect(anonPage).not.toHaveURL(/\/login/);
    await expect(anonPage.getByRole("heading", { name: `Truck ${stamp}` })).toBeVisible();
    await expect(anonPage.getByText("Martin MAC Aura XB")).toBeVisible();
    const anonPdf = await anonPage.request.get(`/api/packing/${listId}/list.pdf`);
    expect(anonPdf.status()).toBe(401);
    const sharedPdf = await anonPage.request.get(`/api/packing/${listId}/list.pdf?share=${shareUrl.split("/").pop()}`);
    expect(sharedPdf.status()).toBe(200);
    await anon.close();

    // Check in: the unit comes back fine, then finish.
    await page.getByRole("link", { name: "Check in", exact: true }).click();
    await page.getByRole("button", { name: "OK, back on shelf" }).click();
    await expect(page.getByText("1 / 1 back").first()).toBeVisible();
    await page.getByRole("button", { name: "Finish check-in" }).click();
    await expect(page.getByText("Checked in", { exact: true })).toBeVisible();

    // Revoked link stops working.
    await page.getByRole("button", { name: "Revoke link" }).click();
    await expect(page.getByRole("button", { name: "Create share link" })).toBeVisible();
    const gone = await page.request.get(shareUrl);
    expect(gone.status()).toBe(404);

    await page.goto(projectUrl);
    await expect(page.getByRole("link", { name: new RegExp(`Truck ${stamp}`) })).toBeVisible();
  });

  test("templates can be created and applied", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await signIn(page, "member@vertigo.test");
    await page.goto("/projects/packing-templates");
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByLabel("Name").fill(`E2E template ${stamp}`);
    await page.getByRole("button", { name: "Save" }).click();
    // Creating a template opens it.
    await expect(page.getByRole("heading", { name: `E2E template ${stamp}` })).toBeVisible();
    await pickOption(page, "Model", "GLP JDC1");
    await page.getByLabel("Quantity").fill("4");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("listitem").getByText("GLP JDC1")).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).first().click();
    await expect(page).toHaveURL(/\/projects\/packing-templates$/);
  });
});
