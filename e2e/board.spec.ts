import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_PASSWORD ?? "vertigo123";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("office screen", () => {
  test("the display account lands on the board and sees nothing else", async ({ page }) => {
    await signIn(page, "screen@vertigo.test");
    await expect(page).toHaveURL(/\/board$/);
    await expect(page.getByRole("heading", { name: "Coming up", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Today/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Tomorrow/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Timeline, next 6 months" })).toBeVisible();
    // No app menu here, and every other page sends it back to the board.
    await expect(page.getByRole("link", { name: "Inventory" })).toHaveCount(0);
    await page.goto("/inventory");
    await expect(page).toHaveURL(/\/board$/);
    // Nor can it read data through the API.
    expect((await page.request.get("/api/v1/models")).status()).toBe(403);
  });

  test("anyone signed in can open the board, from the calendar, with a longer timeline", async ({ page }) => {
    await signIn(page, "viewer@vertigo.test");
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/calendar");
    await expect(page.getByRole("link", { name: "Office screen" })).toHaveAttribute("href", "/board");
    await page.goto("/board?months=12");
    await expect(page.getByRole("region", { name: "Timeline, next 12 months" })).toBeVisible();
  });

  test("the screen account is not offered as crew", async ({ page }) => {
    await signIn(page, "member@vertigo.test");
    await expect(page).toHaveURL(/\/dashboard/);
    // "E2E show" projects are what npm run db:clean-tests removes.
    await page.goto("/projects/new");
    await page.getByLabel("Name", { exact: true }).fill(`E2E show board ${Date.now().toString(36)}`);
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("button", { name: "Add crew" }).click();
    await expect(page.getByRole("dialog").locator("option", { hasText: "Office Screen" })).toHaveCount(0);
    await expect(page.getByRole("dialog").locator("option", { hasText: "Mette Member" })).toHaveCount(1);
  });
});
