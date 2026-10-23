import { expect, test, type Page } from "@playwright/test";
import { buildFixtureWorkbook } from "../src/modules/importer/__tests__/fixture";

const password = process.env.SEED_PASSWORD ?? "vertigo123";
const stamp = Date.now().toString(36);
// "E2E import" in the file name is what npm run db:clean-tests looks for.
const fileName = `E2E import ${stamp}.xlsx`;

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("spreadsheet import", () => {
  test("upload, preview, decide, import", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "admin@vertigo.test");
    await page.goto("/settings/import");
    await expect(page.getByRole("heading", { name: "Import spreadsheet" })).toBeVisible();

    const buffer = Buffer.from((await buildFixtureWorkbook(`e2e-${stamp}`).xlsx.writeBuffer()) as ArrayBuffer);
    await page.getByLabel("Spreadsheet").setInputFiles({ name: fileName, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
    await page.getByRole("button", { name: "Read and preview" }).click();

    await expect(page.getByRole("heading", { name: "Import preview" })).toBeVisible();
    await expect(page.getByText(fileName)).toBeVisible();
    // Nothing has been written yet: the plan is only shown.
    await expect(page.getByText("Needs decision", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/31 here vs 30/)).toBeVisible();
    // Nothing is parked any more: the GearGuys row goes to the sub-hire catalog, the wish row to the wish list.
    await expect(page.getByText(/Sub-hire: Barco UDX-4K32/)).toBeVisible();
    await expect(page.getByText(/Wish list: Epson EB-L1755U/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Parked \(0\)/ })).toBeVisible();

    // The loan was returned, so it must not become a rental.
    const loanRow = page.locator("li", { hasText: `Lånt af Testperson e2e-${stamp}` });
    await loanRow.getByRole("combobox").selectOption("closed");
    await expect(loanRow.getByText("Writes: nothing")).toBeVisible();

    await page.getByRole("button", { name: /^Import \d+ rows$/ }).first().click();
    await expect(page.getByText("Import finished.")).toBeVisible({ timeout: 90_000 });
    // Reloading shows the recorded result, not the plan again.
    await page.reload();
    await expect(page.getByText("Import finished.")).toBeVisible();
    await expect(page.getByText(/0 rentals, /)).toBeVisible();

    // The imported gear is in the inventory with its sheet cell as source.
    await page.goto("/inventory");
    await page.getByPlaceholder(/search/i).fill(`SplitLED e2e-${stamp}`);
    await page.keyboard.press("Enter");
    // The family row shows the name; its 60cm variant sits inside it.
    await expect(page.getByText(`SplitLED e2e-${stamp}`).first()).toBeVisible();
    await expect(page.getByText("60cm").first()).toBeVisible();
  });

  test("a spec sheet fills in empty fields, and replaces a value only when ticked", async ({ page }) => {
    await signIn(page, "admin@vertigo.test");
    await page.goto("/inventory/models/new");
    await page.getByLabel("Manufacturer").fill("Testlight");
    await page.getByLabel("Model name").fill(`Specs ${stamp}`);
    const category = page.getByLabel("Category");
    await category.selectOption((await category.locator("option", { hasText: "Moving heads" }).first().getAttribute("value"))!);
    await page.getByLabel("Weight (kg)").fill("12");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: `Specs ${stamp} Testlight` })).toBeVisible();
    const id = page.url().split("/").pop()!;

    await page.goto("/settings/import");
    await page.getByRole("link", { name: "Import a spec sheet" }).click();
    await expect(page.getByRole("heading", { name: "Import specs" })).toBeVisible();
    const sheet = `﻿Id;Weight (kg);Power (W);Description;Links\r\n${id};13,5;"1.200";"Pan: 540°\r\nTilt: 270°";"Product page | https://example.com/specs"\r\n`;
    await page.getByLabel("Spec sheet").setInputFiles({ name: `specs ${stamp}.csv`, mimeType: "text/csv", buffer: Buffer.from(sheet) });
    await page.getByRole("button", { name: "Preview" }).click();

    await expect(page.getByText("3 empty fields to fill in")).toBeVisible();
    await expect(page.getByText("1 value differs from the model")).toBeVisible();
    await expect(page.getByText("sheet: 13.5")).toBeVisible();
    // The weight the model already has stays unless it is ticked.
    const weight = page.getByRole("checkbox", { name: /^Weight \(kg\):/ });
    await expect(weight).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Save 3 changes on 1 model" })).toBeVisible();
    await weight.check();
    await page.getByRole("button", { name: "Save 4 changes on 1 model" }).click();
    await expect(page.getByRole("status")).toContainText("Done: 4 changes saved on 1 model, and 1 model marked as checked.");

    await page.goto(`/inventory/models/${id}`);
    await expect(page.getByText("1200", { exact: true })).toBeVisible();
    await expect(page.getByText("13,5", { exact: true })).toBeVisible();
    await expect(page.getByText("Tilt: 270°")).toBeVisible();
    await expect(page.getByRole("link", { name: "Product page" })).toBeVisible();
  });

  test("members cannot open the import page", async ({ page }) => {
    await signIn(page, "member@vertigo.test");
    await page.goto("/settings/import");
    await expect(page.getByRole("heading", { name: "Import spreadsheet" })).toHaveCount(0);
  });
});
