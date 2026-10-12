import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_PASSWORD ?? "vertigo123";
const stamp = Date.now().toString(36);
// Own window in 2032 like the other specs, so leftovers never compete for gear.
const base = Date.UTC(2032, 6, 1) + (Date.now() % 300) * 86_400_000;
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

test.describe("pricing", () => {
  test("rate table editor previews the factor and saves tiers", async ({ page }) => {
    await signIn(page, "admin@vertigo.test");
    await page.goto("/settings/pricing");
    await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
    await expect(page.getByText("Standard")).toBeVisible();

    await page.getByRole("link", { name: "New rate table" }).click();
    await page.getByLabel("Name").fill(`E2E table ${stamp}`);
    // Tier rows: 1 → 1, then add 4 → 2.5, rule +0.1 per further day.
    await page.getByLabel("Days 1").fill("1");
    await page.getByLabel("Factor 1").fill("1");
    await page.getByRole("button", { name: "Add tier" }).click();
    await page.getByLabel("Days 2").fill("4");
    await page.getByLabel("Factor 2").fill("2.5");
    await page.getByLabel("Beyond the last tier").selectOption("per_day");
    await page.getByLabel("Extra factor").fill("0.1");
    await page.getByLabel("Factor for").fill("6");
    await expect(page.getByTestId("factor-preview")).toHaveText("2.7");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `E2E table ${stamp}` })).toBeVisible();
    await expect(page.getByLabel("Days 2")).toHaveValue("4");
  });

  test("project quote: reservations priced through the table, extra line, discount, PDF", async ({ page }) => {
    await signIn(page, "member@vertigo.test");
    await page.goto("/projects/new");
    await page.getByLabel("Name").fill(`E2E show ${stamp} quote`);
    await pickOption(page, "Client", "Vega");
    await page.getByLabel("Prep start").fill(day(0));
    await page.getByLabel(/^Return/).fill(day(2));
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `E2E show ${stamp} quote` })).toBeVisible();

    // Reserve 2 Pointes: the day price is filled from the model (400 in the seed).
    await page.getByRole("button", { name: "Reserve gear" }).click();
    await pickOption(page, "Model", "Robe Pointe");
    await expect(page.getByLabel("Day price")).toHaveValue("400");
    await page.getByLabel("Quantity").fill("2");
    await page.getByLabel("Line discount %").fill("50");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    // 2 × 400 × factor 2.0 (Standard, 3 days) = 1600, −50% = 800
    await expect(page.getByRole("cell", { name: "800,00 kr." }).first()).toBeVisible();
    await expect(page.getByTestId("quote-subtotal")).toHaveText("800,00 kr.");

    await page.getByRole("button", { name: "Add line" }).click();
    await page.getByLabel("Description").fill("Freight");
    await page.getByLabel(/^Unit price/).fill("200");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByTestId("quote-subtotal")).toHaveText("1.000,00 kr.");

    await page.getByRole("button", { name: "Pricing settings" }).click();
    await page.getByLabel("Charge days").fill("1");
    await page.getByLabel("Discount %").fill("10");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    // factor 1.0: 2 × 400 = 800 −50% = 400, + 200 = 600, −10% = 540; VAT 135 → 675
    await expect(page.getByTestId("quote-subtotal")).toHaveText("540,00 kr.");
    await expect(page.getByTestId("quote-total")).toHaveText("675,00 kr.");

    const pdf = await page.request.get(page.url().replace(/\/projects\//, "/api/projects/") + "/quote.pdf");
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
  });
});
