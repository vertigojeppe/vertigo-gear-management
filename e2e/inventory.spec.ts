import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_PASSWORD ?? "vertigo123";
const stamp = Date.now().toString(36);

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("inventory", () => {
  test("member creates a model, adds units, changes status with a reason", async ({ page }) => {
    await signIn(page, "member@vertigo.test");

    // New model
    await page.goto("/inventory/models/new");
    await page.getByLabel("Manufacturer").fill("Testlight");
    await page.getByLabel("Model name").fill(`Beam ${stamp}`);
    const category = page.getByLabel("Category");
    const movingHeads = await category.locator("option", { hasText: "Moving heads" }).first().getAttribute("value");
    await category.selectOption(movingHeads!);
    await page.getByLabel("Weight (kg)").fill("12.5");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: `Testlight Beam ${stamp}` })).toBeVisible();

    // Add 2 units with serial numbers
    await page.getByRole("link", { name: "Add items" }).first().click();
    await expect(page.getByRole("heading", { name: "Add items" })).toBeVisible();
    await page.getByLabel("How many units").fill("2");
    await page.getByLabel("Serial numbers").fill("SN-A\nSN-B");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `Testlight Beam ${stamp}` })).toBeVisible();
    await expect(page.getByText("SN SN-A")).toBeVisible();
    await expect(page.getByText("SN SN-B")).toBeVisible();

    // Open the first unit, change status to in repair (reason required)
    await page.getByText("SN SN-A").click();
    await expect(page.getByRole("heading", { name: /Testlight Beam/ })).toBeVisible();
    await page.getByRole("button", { name: "Change status" }).click();
    await page.getByLabel("New status").selectOption("in_repair");
    await page.getByLabel("Reason").fill("Fan rattles");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("heading", { name: /Testlight Beam/ }).getByText("In repair")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Fan rattles" })).toBeVisible();
  });

  test("families group their variants in the list and in the model dropdown", async ({ page }) => {
    await signIn(page, "member@vertigo.test");
    // The seeded DMX 5-pin cables come in 5, 10 and 25 m: one family row that opens to three variants.
    await page.goto("/inventory?q=DMX+5-pin");
    const family = page.locator("summary", { hasText: "DMX 5-pin" });
    await expect(family).toBeVisible();
    await expect(family.getByText("3 variants")).toBeVisible();
    await expect(page.getByRole("link", { name: /^25 m/ })).toBeHidden();
    await family.click();
    await expect(page.getByRole("link", { name: /^25 m/ })).toBeVisible();
    // The item form groups the same family in an optgroup.
    await page.goto("/inventory/items/new");
    await expect(page.getByLabel("Model").locator("optgroup[label=\"DMX 5-pin\"] option")).toHaveCount(3);
  });

  test("bulk bar archives a whole family and brings it back", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await signIn(page, "member@vertigo.test");
    await page.goto("/inventory?q=XLR+3-pin");
    // Ticking the family selects both variants.
    await page.getByRole("checkbox", { name: "XLR 3-pin" }).check();
    await expect(page.getByText("2 models selected")).toBeVisible();
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText("Archived: 2")).toBeVisible();
    await page.goto("/inventory?q=XLR+3-pin&archived=1");
    await expect(page.locator("summary", { hasText: "XLR 3-pin" }).getByText("Archived")).toBeVisible();
    await page.getByRole("checkbox", { name: "XLR 3-pin" }).check();
    await page.getByRole("button", { name: "Unarchive" }).click();
    await expect(page.getByText("Unarchived: 2")).toBeVisible();
    // Deleting is refused for gear that has items, and a member sees who can override.
    await page.getByRole("checkbox", { name: "XLR 3-pin" }).check();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("2 still in use")).toBeVisible();
    await expect(page.getByText("An admin can delete these together with what uses them.")).toBeVisible();
  });

  test("admin edits a whole family (renames every variant)", async ({ page }) => {
    await signIn(page, "admin@vertigo.test");
    await page.goto("/inventory?q=XLR+3-pin");
    await page.locator("summary", { hasText: "XLR 3-pin" }).click();
    await page.getByRole("link", { name: /^5 m/ }).click();
    await expect(page.getByRole("heading", { name: "XLR 3-pin 5 m" })).toBeVisible();
    await page.getByRole("button", { name: "Edit family" }).click();
    await page.getByLabel("Model name").fill(`XLR 3-pin ${stamp}`);
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("heading", { name: `XLR 3-pin ${stamp} 5 m` })).toBeVisible();
    // Every variant followed; put the name back for the next run.
    await page.goto(`/inventory?q=XLR+3-pin+${stamp}`);
    await expect(page.locator("summary", { hasText: `XLR 3-pin ${stamp}` }).getByText("2 variants")).toBeVisible();
    await page.locator("summary", { hasText: `XLR 3-pin ${stamp}` }).click();
    await page.getByRole("link", { name: /^5 m/ }).click();
    await page.getByRole("button", { name: "Edit family" }).click();
    await page.getByLabel("Model name").fill("XLR 3-pin");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("heading", { name: "XLR 3-pin 5 m" })).toBeVisible();
  });

  test("lists export as CSV with their filters", async ({ page }) => {
    await signIn(page, "member@vertigo.test");
    await page.goto("/inventory/items?q=Pointe");
    const href = await page.getByRole("link", { name: "Export CSV" }).getAttribute("href");
    expect(href).toBe("/api/export/items.csv?q=Pointe");
    const csv = await page.request.get(href!);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const text = await csv.text();
    expect(text.startsWith("\uFEFFAsset tag;Model;")).toBe(true);
    expect(text).toContain("Robe Pointe");
    expect(text).not.toContain("MAC Aura");
    for (const list of ["models", "projects", "rentals", "contacts", "wishes", "purchases"]) expect((await page.request.get(`/api/export/${list}.csv`)).status(), list).toBe(200);
    expect((await page.request.get("/api/export/nope.csv")).status()).toBe(404);
  });

  test("labels print as a PDF for a filtered list and for one unit", async ({ page }) => {
    await signIn(page, "member@vertigo.test");
    await page.goto("/inventory/items?q=Pointe");
    await page.getByRole("button", { name: "Print labels" }).click();
    await page.getByLabel("Label size").selectOption("avery_l7160");
    await page.getByLabel("Skip labels on the first sheet").fill("3");
    // The link opens the PDF in a new tab; its address carries the filters, size and offset.
    const href = await page.getByRole("link", { name: "Open PDF" }).getAttribute("href");
    expect(href).toMatch(/^\/api\/labels\/sheet\.pdf\?.*q=Pointe.*size=avery_l7160.*offset=3/);
    const sheet = await page.request.get(href!);
    expect(sheet.status()).toBe(200);
    expect(sheet.headers()["content-type"]).toContain("application/pdf");
    const single = await page.request.get("/api/labels/sheet.pdf?q=VG-0001&size=thermal_62x29");
    expect(single.status()).toBe(200);
    const none = await page.request.get("/api/labels/sheet.pdf?q=nothing-like-this-zzz&size=thermal_62x29");
    expect(none.status()).toBe(404);
  });

  test("a wish is added, converted to a model and shows as bought", async ({ page }) => {
    await signIn(page, "member@vertigo.test");
    await page.goto("/inventory/wishlist");
    await page.getByRole("button", { name: "New wish" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Manufacturer").fill("Testlight");
    await dialog.getByLabel("Name", { exact: true }).fill(`Wish ${stamp}`);
    await dialog.locator("#w-price").fill("1500");
    await dialog.locator("#w-link").fill("https://example.test/wish");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    const row = page.getByRole("listitem").filter({ hasText: `Testlight Wish ${stamp}` });
    await expect(row).toBeVisible();
    await expect(row.getByRole("link", { name: "open link" })).toHaveAttribute("href", "https://example.test/wish");

    // Convert: the new-model form opens prefilled; saving lands on the model and marks the wish bought.
    await row.getByRole("link", { name: "Convert to model" }).click();
    await expect(page.getByRole("heading", { name: "New model from the wish list" })).toBeVisible();
    await expect(page.getByLabel("Model name")).toHaveValue(`Wish ${stamp}`);
    const category = page.getByLabel("Category");
    const movingHeads = await category.locator("option", { hasText: "Moving heads" }).first().getAttribute("value");
    await category.selectOption(movingHeads!);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: `Testlight Wish ${stamp}` })).toBeVisible();

    await page.goto("/inventory/wishlist");
    await expect(page.getByRole("listitem").filter({ hasText: `Wish ${stamp}` })).toHaveCount(0);
    await page.goto("/inventory/wishlist?status=bought");
    const bought = page.getByRole("listitem").filter({ hasText: `Testlight Wish ${stamp}` });
    await expect(bought).toContainText("Became model");
    page.once("dialog", (d) => d.accept());
    await bought.getByRole("button", { name: "Delete" }).click();
    await expect(bought).toHaveCount(0);
  });

  test("a purchase record is added to a model, opened and removed", async ({ page }) => {
    await signIn(page, "admin@vertigo.test");
    // A model of our own, so the record never lands on real gear.
    await page.goto("/inventory/models/new");
    await page.getByLabel("Manufacturer").fill("Testlight");
    await page.getByLabel("Model name").fill(`Bought ${stamp}`);
    const category = page.getByLabel("Category");
    const movingHeads = await category.locator("option", { hasText: "Moving heads" }).first().getAttribute("value");
    await category.selectOption(movingHeads!);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: `Testlight Bought ${stamp}` })).toBeVisible();

    await page.getByRole("button", { name: "Add purchase" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#p-reference").fill(`ORD-${stamp}`);
    await dialog.locator("#p-quantity").fill("4");
    await dialog.locator("#p-list").fill("1000");
    await dialog.locator("#p-discount").fill("25");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    const row = page.getByRole("link", { name: new RegExp(`ORD-${stamp}`) });
    await expect(row).toContainText("4 × 750,00 kr.");
    await expect(page.getByText(/Total across the records/)).toContainText("3.000,00 kr.");

    await row.click();
    await expect(page.getByRole("heading", { name: /Purchases: Testlight Bought/ })).toBeVisible();
    await expect(page.getByText("Net price per unit")).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: `Testlight Bought ${stamp}` })).toBeVisible();
    await expect(page.getByText("No purchase records yet")).toBeVisible();
  });

  test("admin colours a top-level category and the bar shows in the list", async ({ page }) => {
    await signIn(page, "admin@vertigo.test");
    await page.goto("/inventory/categories");
    const video = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Video", exact: true }) }).first();
    await video.getByRole("button", { name: "Cyan" }).click();
    await expect(video.getByRole("button", { name: "Cyan" })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/inventory?q=PT-RZ120");
    await expect(page.locator('li:has-text("PT-RZ120") span[style*="background-color"]').first()).toBeVisible();
    // Back to the seeded colour so the next run starts the same way.
    await page.goto("/inventory/categories");
    await video.getByRole("button", { name: "Blue" }).click();
    await expect(video.getByRole("button", { name: "Blue" })).toHaveAttribute("aria-pressed", "true");
  });

  test("a metre consumable is received, used and runs low", async ({ page }) => {
    await signIn(page, "member@vertigo.test");
    await page.goto("/inventory/models/new");
    await page.getByLabel("Manufacturer").fill("Testlight");
    await page.getByLabel("Model name").fill(`Strip ${stamp}`);
    const category = page.getByLabel("Category");
    await category.selectOption((await category.locator("option", { hasText: "LED strip" }).first().getAttribute("value"))!);
    await page.getByLabel(/^Consumable/).check();
    await page.locator("#unit").selectOption("m");
    await page.locator("#minStock").fill("8");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: `Testlight Strip ${stamp}` })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add items" })).toHaveCount(0);
    const stock = page.getByTestId("consumable-stock");
    await expect(stock).toContainText("0 m");

    await page.getByRole("button", { name: "Receive" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Metres").fill("10");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(stock).toContainText("10 m");

    await page.getByRole("button", { name: "Use", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Metres").fill("2.5");
    await dialog.getByRole("button", { name: "Use", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(stock).toContainText("7,5 m");
    await expect(page.getByText("Running low (minimum 8 m)")).toBeVisible();

    // The dashboard lists it and puts it on the wish list in one click.
    await page.goto("/dashboard");
    // The running-low row: the activity feed below also mentions the model, so pick the row with the wish-list button.
    const row = page.getByRole("listitem").filter({ hasText: `Testlight Strip ${stamp}` }).filter({ has: page.getByRole("button", { name: "Add to wish list" }) });
    await expect(row).toContainText("7,5 m / 8 m");
    await row.getByRole("button", { name: "Add to wish list" }).click();
    // The button turns into a link to the wish list once the wish exists.
    await expect(page.getByRole("listitem").filter({ hasText: `Testlight Strip ${stamp}` }).getByRole("link", { name: "on the wish list" })).toBeVisible();
  });

  test("filters apply while typing, keep focus, and Clear empties them", async ({ page }) => {
    await signIn(page, "viewer@vertigo.test");
    await page.goto("/inventory");
    // The Filter button is only a fallback without JavaScript.
    await expect(page.getByRole("button", { name: "Filter" })).toBeHidden();
    const search = page.getByRole("textbox", { name: "Search" });
    await search.pressSequentially("Pointe", { delay: 40 });
    await expect(page).toHaveURL(/\/inventory\?q=Pointe$/);
    await expect(page.getByText("Robe Pointe").first()).toBeVisible();
    await expect(search).toBeFocused();
    await expect(search).toHaveValue("Pointe");
    // A checkbox applies at once.
    await page.getByLabel("Show archived").check();
    await expect(page).toHaveURL(/archived=1/);
    // Clear navigates away from the filters and the fields follow.
    await page.getByRole("link", { name: "Clear" }).click();
    await expect(page).toHaveURL(/\/inventory$/);
    await expect(search).toHaveValue("");
    await expect(page.getByLabel("Show archived")).not.toBeChecked();
  });

  test("viewer sees inventory but no edit controls", async ({ page }) => {
    await signIn(page, "viewer@vertigo.test");
    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New model" })).toHaveCount(0);
    await page.goto("/inventory/wishlist");
    await expect(page.getByRole("button", { name: "New wish" })).toHaveCount(0);
    // Search for the unit: a database with the real inventory imported has many pages.
    await page.goto("/inventory/items?q=VG-0001");
    await page.getByRole("link", { name: /VG-0001/ }).first().click();
    await expect(page.getByRole("button", { name: "Change status" })).toHaveCount(0);
    await expect(page.getByText("Purchase and value")).toHaveCount(0);
  });

  test("asset tag URL opens the item page and the QR renders", async ({ page }) => {
    await signIn(page, "admin@vertigo.test");
    await page.goto("/t/VG-0001");
    await expect(page).toHaveURL(/\/inventory\/items\//);
    await expect(page.getByText("VG-0001").first()).toBeVisible();
    const qr = page.getByRole("img", { name: "QR VG-0001" });
    await expect(qr).toBeVisible();
  });

  test("REST API works with a bearer token", async ({ page, request }) => {
    await signIn(page, "admin@vertigo.test");
    await page.goto("/settings/account");
    await page.getByLabel("Token name").fill(`e2e ${stamp}`);
    await page.getByRole("button", { name: "Create token" }).click();
    const token = (await page.locator("code", { hasText: /^vg_/ }).first().textContent())?.trim();
    expect(token).toMatch(/^vg_/);

    const res = await request.get("/api/v1/items?q=VG-0001", { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.rows[0].assetTag).toBe("VG-0001");

    const anon = await request.get("/api/v1/items");
    expect(anon.status()).toBe(401);

    // Clean up: revoke the token again.
    page.once("dialog", (d) => d.accept());
    await page.getByRole("listitem").filter({ hasText: `e2e ${stamp}` }).getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText(`e2e ${stamp}`)).toHaveCount(0);
  });
});
