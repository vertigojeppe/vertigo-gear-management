import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_PASSWORD ?? "vertigo123";
const stamp = Date.now().toString(36);
// Dates inside the calendar's default window (it starts three days back).
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("calendar entries", () => {
  test("a member records time off and a meeting, sees them on the calendar, opens and deletes the meeting", async ({ page }) => {
    await signIn(page, "member@vertigo.test");
    await page.goto("/calendar");

    // Time off: whole days, for the person making it.
    await page.getByRole("button", { name: "New entry" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("What").selectOption("time_off");
    await dialog.getByLabel(/^Title/).fill(`E2E course ${stamp}`);
    await dialog.getByLabel("First day").fill(day(2));
    await dialog.getByLabel(/^Last day/).fill(day(3));
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: `Off: Mette Member (E2E course ${stamp})` }).first()).toBeVisible();

    // A meeting with a colleague and a guest.
    await page.getByRole("button", { name: "New entry" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill(`E2E rig check ${stamp}`);
    await dialog.getByLabel("Date").fill(day(4));
    await dialog.getByLabel("From").fill("10:00");
    await dialog.getByLabel(/^To/).fill("11:30");
    await dialog.getByLabel("Alex Admin").check();
    await dialog.getByLabel(/^Guests/).fill("venue@example.com");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("link", { name: `E2E rig check ${stamp}` }).first().click();
    await expect(page.getByRole("heading", { name: `E2E rig check ${stamp}`, level: 1 })).toBeVisible();
    await expect(page.getByText("10:00–11:30")).toBeVisible();
    await expect(page.getByText("Alex Admin, Mette Member")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add to Google Calendar" })).toHaveAttribute("href", /calendar\.google\.com/);
    const ics = await page.request.get(page.url().replace("/calendar/entries/", "/api/agenda/") + "/entry.ics");
    expect(await ics.text()).toContain(`SUMMARY:E2E rig check ${stamp}`);

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(page.getByRole("link", { name: `E2E rig check ${stamp}` })).toHaveCount(0);
  });
});
