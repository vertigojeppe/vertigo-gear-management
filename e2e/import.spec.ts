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
    // Parked rows are collapsed by default; open the group to see why they are parked.
    await page.getByRole("button", { name: /Parked/ }).click();
    await expect(page.getByText(/Sub-hire catalog/)).toBeVisible();

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
    await expect(page.getByText(`SplitLED e2e-${stamp} 60cm`).first()).toBeVisible();
  });

  test("members cannot open the import page", async ({ page }) => {
    await signIn(page, "member@vertigo.test");
    await page.goto("/settings/import");
    await expect(page.getByRole("heading", { name: "Import spreadsheet" })).toHaveCount(0);
  });
});
