import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_PASSWORD ?? "vertigo123";
const stamp = Date.now().toString(36);

// Each run uses its own window in 2032 so leftovers from earlier runs never
// compete for the same gear. (npm run db:clean-tests removes them.)
const base = Date.UTC(2032, 0, 1) + (Date.now() % 300) * 86_400_000;
const day = (n: number) => new Date(base + n * 86_400_000).toISOString().slice(0, 10);

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

test.describe("packing lists", () => {
  test("a list with projectors suggests their spare lamp, which adds as a line", async ({ page }) => {
    await signIn(page, "member@vertigo.test");
    await page.goto("/projects/new");
    await page.getByLabel("Name").fill(`E2E show spares ${stamp}`);
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("link", { name: "New packing list" }).click();
    await page.getByLabel("Name").fill(`Spares ${stamp}`);
    await page.getByLabel("Start from").selectOption("empty");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `Spares ${stamp}` })).toBeVisible();

    // The seed's lamp fits the PT-EZ590: 1 per 4 projectors, at least 1.
    await page.getByLabel("Search gear").fill("PT-EZ590");
    await page.getByRole("button", { name: "Add PT-EZ590", exact: true }).click();
    const spares = page.getByRole("region", { name: "Suggested spares" });
    await expect(spares).toContainText("PT-EZ590 replacement lamp");
    await spares.getByRole("button", { name: "Add 1 × PT-EZ590 replacement lamp" }).click();
    await expect(page.getByRole("link", { name: "PT-EZ590 replacement lamp" })).toBeVisible();
    await expect(spares).toHaveCount(0);
  });

  test("pack all units of a line in one tap, and undo a packed unit", async ({ page }, info) => {
    await signIn(page, "member@vertigo.test");
    await page.goto("/projects/new");
    await page.getByLabel("Name").fill(`E2E show pack-all ${stamp}-${info.project.name}`);
    await page.getByLabel("Status").selectOption("confirmed");
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("link", { name: "New packing list" }).click();
    await page.getByLabel("Name").fill(`Van ${stamp}`);
    await page.getByLabel("Start from").selectOption("empty");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `Van ${stamp}` })).toBeVisible();

    // Three of one model: one line.
    await page.getByLabel("Search gear").fill("aura xb");
    await page.getByLabel("Quantity MAC Aura XB").fill("3");
    await page.getByLabel("Quantity MAC Aura XB").press("Enter");
    await expect(page.getByRole("button", { name: "Add MAC Aura XB" })).toHaveText(/Added/);

    await page.getByRole("link", { name: "Pack", exact: true }).click();
    await expect(page.getByText("0 / 3 packed")).toBeVisible();
    await page.getByRole("button", { name: "Pack all 3 MAC Aura XB" }).click();
    await expect(page.getByText("3 / 3 packed")).toBeVisible();

    // The finished line stays on screen with an Undo per unit; one wrong unit comes off.
    const undo = page.getByRole("button", { name: /^Undo MAC Aura XB/ });
    await expect(undo).toHaveCount(3);
    await undo.first().click();
    await expect(page.getByText("2 / 3 packed")).toBeVisible();
    await expect(undo).toHaveCount(2);
    // One left to pack: the single-unit tick takes over from Pack all.
    await expect(page.getByRole("button", { name: /^Pack all/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Tick unit" }).click();
    await expect(page.getByText("3 / 3 packed")).toBeVisible();
  });

  test("pack, check out, share, check in", async ({ page, browser }) => {
    page.on("dialog", (d) => d.accept());
    await signIn(page, "admin@vertigo.test");

    // A project of our own so the seeded ones stay untouched.
    await page.goto("/projects/new");
    await page.getByLabel("Name").fill(`E2E show ${stamp}`);
    await pickOption(page, "Client", "Vega");
    await page.getByLabel("Status").selectOption("confirmed");
    await page.getByLabel("Prep start").fill(day(0));
    await page.getByLabel(/^Return/).fill(day(2));
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `E2E show ${stamp}` })).toBeVisible();
    const projectUrl = page.url();

    // Empty list, then one unit of a seeded model.
    await page.getByRole("link", { name: "New packing list" }).click();
    await page.getByLabel("Name").fill(`Truck ${stamp}`);
    await page.getByLabel("Start from").selectOption("empty");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `Truck ${stamp}` })).toBeVisible();
    await expect(page.getByText("Nothing on the list yet")).toBeVisible();
    const listUrl = page.url();
    const listId = listUrl.split("/").pop()!;

    // Type to search, Enter adds the first match; the row then says it was added.
    await page.getByLabel("Search gear").fill("aura xb");
    await expect(page.getByText("Lighting › Moving heads", { exact: false }).first()).toBeVisible();
    await page.getByLabel("Search gear").press("Enter");
    await expect(page.getByRole("button", { name: "Add MAC Aura XB" })).toHaveText(/Added/);
    await expect(page.getByRole("link", { name: "MAC Aura XB" })).toBeVisible();

    // Packing mode: unknown tag is reported, choosing a unit ticks it.
    await page.getByRole("link", { name: "Pack", exact: true }).click();
    await expect(page.getByText("0 / 1 packed")).toBeVisible();
    await page.getByLabel("Scan or type a tag").fill("VG-999999");
    await page.getByRole("button", { name: "Scan", exact: true }).click();
    await expect(page.getByText("No item with tag VG-999999.")).toBeVisible();
    await page.getByRole("button", { name: "Tick unit" }).click();
    await expect(page.getByText("1 / 1 packed")).toBeVisible();
    await expect(page.getByText("Everything is packed.").first()).toBeVisible();

    // Check out.
    await page.goto(listUrl);
    await page.getByRole("button", { name: "Check out" }).click();
    await expect(page.getByText("Checked out", { exact: true })).toBeVisible();
    await expect(page.getByText("0 / 1 back").first()).toBeVisible();

    // PDF for a signed-in user, and the share link for anyone.
    const pdf = await page.request.get(`/api/packing/${listId}/list.pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");

    await page.getByRole("button", { name: "Create share link" }).click();
    const shareUrl = (await page.locator("code").first().textContent())!.trim();
    expect(shareUrl).toContain("/share/packing/");
    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto(shareUrl);
    await expect(anonPage).not.toHaveURL(/\/login/);
    await expect(anonPage.getByRole("heading", { name: `Truck ${stamp}` })).toBeVisible();
    await expect(anonPage.getByText("MAC Aura XB")).toBeVisible();
    const anonPdf = await anonPage.request.get(`/api/packing/${listId}/list.pdf`);
    expect(anonPdf.status()).toBe(401);
    const sharedPdf = await anonPage.request.get(`/api/packing/${listId}/list.pdf?share=${shareUrl.split("/").pop()}`);
    expect(sharedPdf.status()).toBe(200);
    await anon.close();

    // Check in: the unit comes back fine, then finish.
    await page.getByRole("link", { name: "Check in", exact: true }).click();
    await page.getByRole("button", { name: "OK, back on shelf" }).click();
    await expect(page.getByText("1 / 1 back").first()).toBeVisible();
    // A wrong tap can be undone, then recorded again.
    await page.getByRole("button", { name: "Undo this return" }).click();
    await expect(page.getByText("0 / 1 back").first()).toBeVisible();
    await page.getByRole("button", { name: "OK, back on shelf" }).click();
    await expect(page.getByText("1 / 1 back").first()).toBeVisible();
    await page.getByRole("button", { name: "Finish check-in" }).click();
    await expect(page.getByText("Checked in", { exact: true })).toBeVisible();

    // Revoked link stops working.
    await page.getByRole("button", { name: "Revoke link" }).click();
    await expect(page.getByRole("button", { name: "Create share link" })).toBeVisible();
    const gone = await page.request.get(shareUrl);
    expect(gone.status()).toBe(404);

    await page.goto(projectUrl);
    await expect(page.getByRole("link", { name: new RegExp(`Truck ${stamp}`) })).toBeVisible();
  });

  test("templates can be created and applied", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await signIn(page, "member@vertigo.test");
    await page.goto("/projects/packing-templates");
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByLabel("Name").fill(`E2E template ${stamp}`);
    await page.getByRole("button", { name: "Save" }).click();
    // Creating a template opens it.
    await expect(page.getByRole("heading", { name: `E2E template ${stamp}` })).toBeVisible();
    await page.getByLabel("Search gear").fill("jdc1");
    await page.getByLabel("Quantity JDC1").fill("4");
    await page.getByRole("button", { name: "Add JDC1" }).click();
    await expect(page.getByRole("button", { name: "Add JDC1" })).toHaveText(/Added/);
    await expect(page.getByRole("listitem").getByText("4×")).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).first().click();
    await expect(page).toHaveURL(/\/projects\/packing-templates$/);
  });
});
