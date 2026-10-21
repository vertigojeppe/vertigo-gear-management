import { expect, test } from "@playwright/test";

/**
 * The language switch: on the sign-in page it sets this browser's language;
 * signed in, it is saved on the user and wins over a Danish browser on
 * another device. Uses a throwaway e2e-lang-* user (db:clean-tests removes it).
 */
const password = process.env.SEED_PASSWORD ?? "vertigo123";
const stamp = Date.now().toString(36);

test("switch language signed out and signed in; the user's choice follows them", async ({ page, browser }, info) => {
  const email = `e2e-lang-${stamp}-${info.project.name}@vertigo.test`;
  const userPassword = `pw-${stamp}-secret`;

  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@vertigo.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/settings/users/new");
  await page.getByLabel("Name").fill(`E2E Lang ${stamp}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Role").selectOption("viewer");
  await page.getByLabel(/^Password/).fill(userPassword);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/settings\/users/);

  // Signed out: the switch on the sign-in page.
  const first = await (await browser.newContext({ locale: "en-GB" })).newPage();
  await first.goto("/login");
  await expect(first.getByRole("button", { name: "Sign in" })).toBeVisible();
  await first.getByRole("radio", { name: "Dansk" }).click();
  await expect(first.getByRole("button", { name: "Log ind" })).toBeVisible();
  await first.getByLabel("E-mail").fill(email);
  await first.getByLabel("Adgangskode").fill(userPassword);
  await first.getByRole("button", { name: "Log ind" }).click();
  await expect(first).toHaveURL(/\/dashboard/);
  await expect(first.locator("html")).toHaveAttribute("lang", "da");

  // Signed in: switch back to English on the account page; saved on the user.
  await first.goto("/settings/account");
  await expect(first.getByRole("heading", { name: "Din konto" })).toBeVisible();
  await first.getByRole("main").getByRole("radio", { name: "English" }).click();
  await expect(first.getByRole("heading", { name: "Your account" })).toBeVisible();

  // Another device with a Danish browser: the sign-in page is Danish, the signed-in app follows the user.
  const second = await (await browser.newContext({ locale: "da-DK" })).newPage();
  await second.goto("/login");
  await expect(second.getByRole("button", { name: "Log ind" })).toBeVisible();
  await second.getByLabel("E-mail").fill(email);
  await second.getByLabel("Adgangskode").fill(userPassword);
  await second.getByRole("button", { name: "Log ind" }).click();
  await expect(second).toHaveURL(/\/dashboard/);
  await expect(second.locator("html")).toHaveAttribute("lang", "en");
});
