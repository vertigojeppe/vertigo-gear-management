import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_PASSWORD ?? "vertigo123";
const stamp = Date.now().toString(36);

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("inventory", () => {
  test("member creates a model, adds units, changes status with a reason", async ({ page }) => {
    await signIn(page, "member@vertigo.test");

    // New model
    await page.goto("/inventory/models/new");
    await page.getByLabel("Manufacturer").fill("Testlight");
    await page.getByLabel("Model name").fill(`Beam ${stamp}`);
    const category = page.getByLabel("Category");
    const movingHeads = await category.locator("option", { hasText: "Moving heads" }).first().getAttribute("value");
    await category.selectOption(movingHeads!);
    await page.getByLabel("Weight (kg)").fill("12.5");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: `Testlight Beam ${stamp}` })).toBeVisible();

    // Add 2 units with serial numbers
    await page.getByRole("link", { name: "Add items" }).first().click();
    await expect(page.getByRole("heading", { name: "Add items" })).toBeVisible();
    await page.getByLabel("How many units").fill("2");
    await page.getByLabel("Serial numbers").fill("SN-A\nSN-B");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `Testlight Beam ${stamp}` })).toBeVisible();
    await expect(page.getByText("SN SN-A")).toBeVisible();
    await expect(page.getByText("SN SN-B")).toBeVisible();

    // Open the first unit, change status to in repair (reason required)
    await page.getByText("SN SN-A").click();
    await expect(page.getByRole("heading", { name: /Testlight Beam/ })).toBeVisible();
    await page.getByRole("button", { name: "Change status" }).click();
    await page.getByLabel("New status").selectOption("in_repair");
    await page.getByLabel("Reason").fill("Fan rattles");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("heading", { name: /Testlight Beam/ }).getByText("In repair")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Fan rattles" })).toBeVisible();
  });

  test("viewer sees inventory but no edit controls", async ({ page }) => {
    await signIn(page, "viewer@vertigo.test");
    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New model" })).toHaveCount(0);
    // Search for the unit: a database with the real inventory imported has many pages.
    await page.goto("/inventory/items?q=VG-0001");
    await page.getByRole("link", { name: /VG-0001/ }).first().click();
    await expect(page.getByRole("button", { name: "Change status" })).toHaveCount(0);
    await expect(page.getByText("Purchase and value")).toHaveCount(0);
  });

  test("asset tag URL opens the item page and the QR renders", async ({ page }) => {
    await signIn(page, "admin@vertigo.test");
    await page.goto("/t/VG-0001");
    await expect(page).toHaveURL(/\/inventory\/items\//);
    await expect(page.getByText("VG-0001").first()).toBeVisible();
    const qr = page.getByRole("img", { name: "QR VG-0001" });
    await expect(qr).toBeVisible();
  });

  test("REST API works with a bearer token", async ({ page, request }) => {
    await signIn(page, "admin@vertigo.test");
    await page.goto("/settings/account");
    await page.getByLabel("Token name").fill(`e2e ${stamp}`);
    await page.getByRole("button", { name: "Create token" }).click();
    const token = (await page.locator("code", { hasText: /^vg_/ }).first().textContent())?.trim();
    expect(token).toMatch(/^vg_/);

    const res = await request.get("/api/v1/items?q=VG-0001", { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.rows[0].assetTag).toBe("VG-0001");

    const anon = await request.get("/api/v1/items");
    expect(anon.status()).toBe(401);

    // Clean up: revoke the token again.
    page.once("dialog", (d) => d.accept());
    await page.getByRole("listitem").filter({ hasText: `e2e ${stamp}` }).getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText(`e2e ${stamp}`)).toHaveCount(0);
  });
});
