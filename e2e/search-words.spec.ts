import { expect, test } from "@playwright/test";

/**
 * Settings › Search words: the seeded list shows and saves, and a Danish
 * word finds gear named and filed in English ("projektor" → the
 * projectors, through the glossary and the category name).
 */
const password = process.env.SEED_PASSWORD ?? "vertigo123";

test("search words: edit the list, and a Danish word finds English-named gear", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@vertigo.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/settings/search");
  await expect(page.getByRole("heading", { name: "Search words" })).toBeVisible();
  await expect(page.getByLabel("Groups")).toHaveValue(/arbejdslys, arbejdslampe, worklight/);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Saved \d+ groups/)).toBeVisible();

  await page.goto("/inventory?q=projektor");
  await expect(page.getByRole("link", { name: /PT-RZ21K/ }).first()).toBeVisible();
  await expect(page.getByText("No exact match")).toHaveCount(0);
});
