import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_PASSWORD ?? "vertigo123";
const stamp = Date.now().toString(36);

// Each run uses its own window in 2032 so leftovers from earlier runs never
// compete for the same gear. (npm run db:clean-tests removes them.)
const base = Date.UTC(2032, 0, 1) + (Date.now() % 300) * 86_400_000;
const day = (n: number) => new Date(base + n * 86_400_000).toISOString().slice(0, 10);
const dmy = (iso: string) => iso.split("-").reverse().join(".");

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

test.describe("projects and rentals", () => {
  test("member creates a project, reserves gear, and sees a conflict warning", async ({ page }) => {
    await signIn(page, "member@vertigo.test");

    await page.goto("/projects/new");
    await page.getByLabel("Name").fill(`E2E show ${stamp}`);
    // A client can be created from the dropdown and is selected afterwards.
    await page.getByRole("button", { name: "New client" }).click();
    await page.getByLabel("Company / name").fill(`E2E client ${stamp}`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByLabel(/^Client/)).toHaveValue(/.+/);
    await expect(page.getByLabel(/^Client/).locator("option:checked")).toHaveText(`E2E client ${stamp}`);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(`E2E show ${stamp}`);
    await page.getByLabel("Status").selectOption("confirmed");
    await page.getByLabel("Prep start").fill(day(0));
    await page.getByLabel("Load-in").fill(`${day(1)}T08:00`);
    await page.getByLabel(/^Return/).fill(day(3));
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `E2E show ${stamp}` })).toBeVisible();
    await expect(page.getByText(`Gear reserved ${dmy(day(0))} – ${dmy(day(3))}`)).toBeVisible();

    // Reserve 2 of a model that has 2 owned: fits.
    await page.getByRole("button", { name: "Reserve gear" }).click();
    await pickOption(page, "Model", "Panasonic PT-RZ21K");
    await page.getByLabel("Quantity").fill("2");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("link", { name: "Panasonic PT-RZ21K" })).toBeVisible();

    // Reserve 3 more of the same model in the same window: conflict.
    await page.getByRole("button", { name: "Reserve gear" }).click();
    await pickOption(page, "Model", "Panasonic PT-RZ21K");
    await page.getByLabel("Quantity").fill("3");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("alert").getByText("Not enough available")).toBeVisible();
    await expect(page.getByRole("alert").getByText(`E2E show ${stamp}`)).toBeVisible();

    // Override.
    await page.getByLabel("Reserve anyway (I know it overlaps)").check();
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Over-booked").first()).toBeVisible();

    // Calendar shows the project.
    await page.goto(`/calendar?from=${day(-2)}&weeks=2`);
    await expect(page.getByRole("link", { name: `E2E show ${stamp}` }).first()).toBeVisible();
    await expect(page.getByText("Panasonic PT-RZ21K:")).toBeVisible();
  });

  test("rental: add a line, hand out, return", async ({ page }) => {
    await signIn(page, "member@vertigo.test");
    await page.goto("/rentals/new");
    await pickOption(page, "Renter", "Nordic Light Rental");
    await page.getByLabel(/^From$/).fill(day(10));
    await page.getByLabel(/^To$/).fill(day(12));
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: "Nordic Light Rental" })).toBeVisible();

    await page.getByRole("button", { name: "Add gear" }).click();
    await pickOption(page, "Model", "Robe Pointe");
    await page.getByLabel("Quantity").fill("2");
    await page.getByLabel(/Per day/).fill("400");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("cell", { name: "2.400,00 kr." }).first()).toBeVisible(); // 2 × 3 days × 400 (line and subtotal)

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Hand out" }).click();
    await expect(page.getByRole("heading", { name: "Nordic Light Rental" }).getByText("Out")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Mark returned" }).click();
    await expect(page.getByRole("heading", { name: "Nordic Light Rental" }).getByText("Returned")).toBeVisible();

    const pdf = await page.request.get(page.url().replace(/\/rentals\//, "/api/rentals/") + "/agreement.pdf");
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
  });

  test("iCal feed answers with a calendar", async ({ page }) => {
    await signIn(page, "admin@vertigo.test");
    await page.goto("/settings/calendar");
    const url = (await page.locator("code").first().textContent())?.trim();
    expect(url).toMatch(/\/api\/calendar\/.+\.ics$/);
    const res = await page.request.get(url!);
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("BEGIN:VCALENDAR");
  });
});
