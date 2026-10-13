import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_PASSWORD ?? "vertigo123";

async function signOut(page: Page) {
  // Desktop: icon button in the sidebar. Phone: inside the "More" sheet.
  const more = page.getByRole("button", { name: "More" });
  if (await more.isVisible()) await more.click();
  await page.getByRole("button", { name: "Sign out" }).click();
}

test("anonymous visitor is sent to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("seeded admin can sign in, navigate and sign out", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@vertigo.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  // Every nav destination resolves (no 404s) and marks itself active.
  await page.getByRole("link", { name: "Inventory" }).first().click();
  await expect(page).toHaveURL(/\/inventory/);
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();

  await signOut(page);
  await expect(page).toHaveURL(/\/login/);
});

<<<<<<< HEAD
test("an admin can download a backup; members cannot", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@vertigo.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/settings/backup");
  await expect(page.getByRole("heading", { name: "Backup", exact: true })).toBeVisible();
  const res = await page.request.get("/api/backup.json");
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.version).toBe(1);
  expect(Array.isArray(data.tables.User)).toBe(true);
  expect(data.tables.Item.length).toBeGreaterThan(0);
=======
test("ten wrong passwords lock the form for a while", async ({ page }) => {
  // A throwaway email, so the throttle never touches the seeded accounts other tests sign in with.
  const email = `nobody-${Date.now().toString(36)}@vertigo.test`;
  await page.goto("/login");
  for (let i = 0; i < 10; i++) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Wrong email or password.")).toBeVisible();
  }
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/Too many attempts/)).toBeVisible();
>>>>>>> origin/main
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@vertigo.test");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();
});
