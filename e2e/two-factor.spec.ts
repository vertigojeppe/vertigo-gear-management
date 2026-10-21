import { expect, test, type Browser, type Page } from "@playwright/test";
import { totpCode, totpStep } from "../src/lib/auth/totp";

/**
 * Two-factor sign-in end to end with a throwaway member (db:clean-tests
 * removes e2e-2fa-* users): set up from the account page with a code
 * computed from the shown key, then sign in with an app code and with a
 * recovery code. The server runs with TWO_FACTOR_REQUIRED_ROLES=none so
 * the other specs' admin sign-ins are not sent to the setup page.
 */
const password = process.env.SEED_PASSWORD ?? "vertigo123";
const stamp = Date.now().toString(36);

async function signIn(page: Page, email: string, pw: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function freshPage(browser: Browser) {
  return (await browser.newContext()).newPage();
}

test.describe("two-factor sign-in", () => {
  test("set up with an authenticator app, sign in with a code and with a recovery code", async ({ page, browser }, info) => {
    const email = `e2e-2fa-${stamp}-${info.project.name}@vertigo.test`;
    const userPassword = `pw-${stamp}-secret`;

    // An admin creates the member.
    await signIn(page, "admin@vertigo.test", password);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/settings/users/new");
    await page.getByLabel("Name").fill(`E2E 2FA ${stamp}`);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Role").selectOption("member");
    await page.getByLabel(/^Password/).fill(userPassword);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/settings\/users/);

    // The member turns 2FA on from the account page.
    const member = await freshPage(browser);
    await signIn(member, email, userPassword);
    await expect(member).toHaveURL(/\/dashboard/);
    await member.goto("/settings/account");
    await member.getByRole("link", { name: "Set up two-factor sign-in" }).click();
    await expect(member.getByRole("heading", { name: "Two-factor sign-in" })).toBeVisible();
    const secret = (await member.getByTestId("totp-secret").innerText()).replace(/\s/g, "");
    await member.getByLabel("6-digit code").fill("000000");
    await member.getByRole("button", { name: "Turn on" }).click();
    await expect(member.getByText("That code does not match")).toBeVisible();
    const setupStep = totpStep();
    await member.getByLabel("6-digit code").fill(totpCode(secret, setupStep));
    await member.getByRole("button", { name: "Turn on" }).click();
    await expect(member.getByText("Two-factor sign-in is on.")).toBeVisible();
    const recovery = await member.getByRole("list", { name: "Your recovery codes" }).getByRole("listitem").allInnerTexts();
    expect(recovery).toHaveLength(10);
    await member.getByRole("link", { name: "I have saved the codes, continue" }).click();
    await expect(member.getByText(/On since .*10 recovery codes left/)).toBeVisible();

    // Password alone is not enough any more; a wrong code is refused; the next app code works.
    const second = await freshPage(browser);
    await signIn(second, email, userPassword);
    await expect(second.getByLabel("Code from your authenticator app")).toBeVisible();
    await expect(second.getByLabel("Password")).toBeHidden();
    await second.getByLabel("Code from your authenticator app").fill("000000");
    await second.getByRole("button", { name: "Sign in" }).click();
    await expect(second.getByText("That code did not work")).toBeVisible();
    await second.getByLabel("Code from your authenticator app").fill(totpCode(secret, Math.max(setupStep, totpStep()) + 1));
    await second.getByRole("button", { name: "Sign in" }).click();
    await expect(second).toHaveURL(/\/dashboard/);

    // Lost phone: a recovery code signs in once.
    const third = await freshPage(browser);
    await signIn(third, email, userPassword);
    await third.getByLabel("Code from your authenticator app").fill(recovery[0]);
    await third.getByRole("button", { name: "Sign in" }).click();
    await expect(third).toHaveURL(/\/dashboard/);
    await third.goto("/settings/account");
    await expect(third.getByText(/9 recovery codes left/)).toBeVisible();
  });
});
