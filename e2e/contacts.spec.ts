import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_PASSWORD ?? "vertigo123";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("contact library", () => {
  test("a library contact goes on a project, a new one joins the library, and the contact page lists the job", async ({ page }, info) => {
    const stamp = `${Date.now().toString(36)}${info.project.name.slice(0, 1)}`;
    const vera = `E2E contact Vera ${stamp}`;
    const rasmus = `E2E contact Rasmus ${stamp}`;
    await signIn(page, "member@vertigo.test");

    // Into the library.
    await page.goto("/contacts");
    await expect(page.getByRole("heading", { name: "Contacts" })).toBeVisible();
    await page.getByRole("button", { name: "New contact" }).first().click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill(vera);
    await dialog.getByLabel("Organisation").fill(`E2E Hall ${stamp}`);
    await dialog.getByLabel("Phone").fill("+45 11 22 33 44");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    // Forgiving search: the organisation, without spaces.
    await page.getByLabel("Search").fill(`e2ehall${stamp}`);
    await expect(page.getByRole("link", { name: new RegExp(vera) })).toBeVisible();

    // A project picks her from the library, and adds someone new.
    await page.goto("/projects/new");
    await page.getByLabel("Name", { exact: true }).fill(`E2E show contacts ${stamp}`);
    await page.getByLabel("Prep start").fill("2033-05-01");
    await page.getByLabel(/^Return/).fill("2033-05-02");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `E2E show contacts ${stamp}` })).toBeVisible();

    await page.getByRole("button", { name: "Add contact" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Contact", { exact: true }).selectOption({ label: `${vera} (E2E Hall ${stamp})` });
    await expect(dialog.getByLabel("Phone")).toHaveCount(0);
    await dialog.getByLabel("Role").fill("Venue tech");
    await dialog.getByRole("button", { name: "Add" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: vera })).toBeVisible();
    await expect(page.getByText("+45 11 22 33 44")).toBeVisible();

    await page.getByRole("button", { name: "Add contact" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill(rasmus);
    await dialog.getByLabel("Phone").fill("22 33 44 55");
    await dialog.getByLabel("Role").fill("Rigger");
    await dialog.getByRole("button", { name: "Add" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: rasmus })).toBeVisible();

    // Her page lists the job; she cannot be deleted while she is on it.
    await page.getByRole("link", { name: vera }).click();
    await expect(page.getByRole("heading", { name: vera })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`E2E show contacts ${stamp}.*Venue tech`) })).toBeVisible();
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("This contact is on 1 project. Remove it there first.")).toBeVisible();

    // The new person is in the library too.
    await page.goto(`/contacts?q=${encodeURIComponent(rasmus)}`);
    await expect(page.getByRole("link", { name: new RegExp(rasmus) })).toContainText("1 project");
  });
});
