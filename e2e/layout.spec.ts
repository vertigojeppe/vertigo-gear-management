import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_PASSWORD ?? "vertigo123";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function chooseLayout(page: Page, name: "Roomy" | "Compact") {
  await page.goto("/settings/layout");
  await page.getByRole("radio", { name: new RegExp(`^${name}`) }).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved. Every page now uses this layout.")).toBeVisible();
}

test.describe("layout setting", () => {
  // One setting for everyone: run it once, not in parallel on the phone project too.
  test.skip(({ isMobile }) => isMobile, "app-wide setting; desktop only");

  test("an admin switches between roomy and compact for everyone", async ({ page, browser }) => {
    await signIn(page, "admin@vertigo.test");
    await page.goto("/settings");
    await page.getByRole("link", { name: /^Layout/ }).click();
    await expect(page.getByRole("heading", { name: "Layout" })).toBeVisible();

    try {
      await chooseLayout(page, "Compact");
      // Another person sees it too.
      const other = await browser.newPage();
      await signIn(other, "viewer@vertigo.test");
      await expect(other.locator('[data-layout="compact"]')).toHaveCount(1);
      await other.close();
    } finally {
      await chooseLayout(page, "Roomy");
    }
    await page.goto("/dashboard");
    await expect(page.locator('[data-layout="roomy"]')).toHaveCount(1);
  });

  test("members cannot change it", async ({ page }) => {
    await signIn(page, "member@vertigo.test");
    await page.goto("/settings");
    await expect(page.getByRole("link", { name: /^Layout/ })).toHaveCount(0);
  });
});
