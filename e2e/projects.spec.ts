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
  test("gear rented in from a partner shows on the project, the quote and the packing list", async ({ page }) => {
    await signIn(page, "member@vertigo.test");
    // The partner company and the catalog item.
    await page.goto("/settings/contacts");
    await page.getByRole("button", { name: "New contact" }).first().click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Type").selectOption("company");
    await dialog.getByLabel("Name", { exact: true }).fill(`Partner ${stamp}`);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await page.goto("/inventory/subhire");
    await page.getByRole("button", { name: "New sub-hire item" }).first().click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Owned by").selectOption({ label: `Partner ${stamp}` });
    await dialog.locator("#sh-manufacturer").fill("Testlight");
    await dialog.getByLabel("Name", { exact: true }).fill(`Lens ${stamp}`);
    await dialog.locator("#sh-cost").fill("500");
    await dialog.locator("#sh-price").fill("800");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: `rent in from Partner ${stamp}` })).toBeVisible();

    // A project that rents it in.
    await page.goto("/projects/new");
    await page.getByLabel("Name", { exact: true }).fill(`E2E show sub-hire ${stamp}`);
    await page.getByLabel("Prep start").fill("2033-04-01");
    await page.getByLabel(/^Return/).fill("2033-04-03");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `E2E show sub-hire ${stamp}` })).toBeVisible();
    await page.getByRole("button", { name: "Rent in" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Item").selectOption({ label: `Testlight Lens ${stamp}` });
    await expect(dialog.locator("#sh-line-price")).toHaveValue("800");
    await dialog.locator("#sh-line-qty").fill("2");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    const line = page.getByRole("listitem").filter({ hasText: `Testlight Lens ${stamp}` }).first();
    await expect(line).toContainText(`rent in from Partner ${stamp}`);
    // On the quote: priced like gear, owner named, cost shown.
    const quoteRow = page.getByRole("row").filter({ hasText: `Lens ${stamp} (rent in from Partner ${stamp})` });
    await expect(quoteRow).toContainText("costs us");
    await expect(quoteRow).toContainText("800,00");

    // On a packing list of the project.
    await page.getByRole("link", { name: "New packing list" }).click();
    await page.getByLabel("Name").fill(`List ${stamp}`);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `List ${stamp}` })).toBeVisible();
    await expect(page.getByText("Rented in")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: `Testlight Lens ${stamp}` })).toContainText(`rent in from Partner ${stamp}`);
  });

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
    await page.getByLabel("Build-up start").fill(day(1));
    await page.getByLabel("Build-up end").fill(day(2));
    await page.getByLabel("Build-up call time").fill("08:00");
    await page.getByLabel(/^Return/).fill(day(3));
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `E2E show ${stamp}` })).toBeVisible();
    // Build-up is one range of days with one call time.
    await expect(page.getByText(`${dmy(day(1))} – ${dmy(day(2))} · call 08:00`)).toBeVisible();
    await expect(page.getByText(`Gear reserved ${dmy(day(0))} – ${dmy(day(3))}`)).toBeVisible();

    // Reserve 2 of a model that has 2 owned: fits.
    await page.getByRole("button", { name: "Reserve gear" }).click();
    await pickOption(page, "Model", "Panasonic PT-RZ21K");
    await page.getByLabel("Quantity").fill("2");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    // A leftover run in the same date window may already hold them: accept the overlap.
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 4000 }).catch(async () => {
      await page.getByLabel("Reserve anyway (I know it overlaps)").check();
      await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();
    });
    await expect(page.getByRole("link", { name: "Panasonic PT-RZ21K" }).first()).toBeVisible(); // reservation list and quote table

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
    await page.getByRole("button", { name: "New client" }).click();
    await page.getByLabel("Company / name").fill(`E2E client ${stamp} rental`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByLabel(/^Renter/).locator("option:checked")).toHaveText(`E2E client ${stamp} rental`);
    await page.getByLabel(/^From$/).fill(day(10));
    await page.getByLabel(/^To$/).fill(day(12));
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `E2E client ${stamp} rental` })).toBeVisible();

    await page.getByRole("button", { name: "Add gear" }).click();
    await pickOption(page, "Model", "Robe Pointe");
    await page.getByLabel("Quantity").fill("2");
    await page.getByLabel(/Per day/).fill("400");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("cell", { name: "1.600,00 kr." }).first()).toBeVisible(); // 2 × 400 × factor 2.0 (Standard, 3 days)

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Hand out" }).click();
    await expect(page.getByRole("heading", { name: `E2E client ${stamp} rental` }).getByText("Out")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Mark returned" }).click();
    await expect(page.getByRole("heading", { name: `E2E client ${stamp} rental` }).getByText("Returned")).toBeVisible();

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
