import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * The apps list: a link, a tool that runs sandboxed inside the app, and a
 * file with versions that only an admin can delete. Everything is named
 * "E2E …" so db:clean-tests removes it.
 */
const password = process.env.SEED_PASSWORD ?? "vertigo123";
const stamp = Date.now().toString(36);

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function newApp(page: Page, name: string, kind: string, extra?: (dialog: ReturnType<Page["getByRole"]>) => Promise<void>) {
  await page.goto("/apps");
  await page.getByRole("button", { name: "New app" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Kind").selectOption({ label: kind });
  await dialog.getByLabel(/^Group/).fill("E2E");
  if (extra) await extra(dialog);
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function upload(page: Page, name: string, mimeType: string, body: string, label?: string) {
  if (label) await page.getByLabel(/^Version/).fill(label);
  await page.getByLabel("Upload a version").setInputFiles({ name, mimeType, buffer: Buffer.from(body) });
  await expect(page.getByRole("link", { name: `Download ${label ?? name}` })).toBeVisible();
}

test.describe("apps", () => {
  test("links, a sandboxed tool, and file versions only admins delete", async ({ page, browser }, info) => {
    const p = `${stamp}-${info.project.name}`;
    await signIn(page, "member@vertigo.test");

    // A link opens the web tool.
    await newApp(page, `E2E link ${p}`, "Link to a web tool", (d) => d.getByLabel("Address").fill("https://example.test/lux"));
    await expect(page.getByRole("link", { name: `Open E2E link ${p}` })).toHaveAttribute("href", "https://example.test/lux");

    // A tool runs inside, in a sandbox that cannot read the app's cookies.
    await newApp(page, `E2E tool ${p}`, "Tool in the app");
    const html = `<!doctype html><title>t</title><h1 id="t">Hello from the tool</h1><script>var c;try{c=document.cookie.length}catch(e){c="blocked"}document.getElementById("t").textContent+=" / cookie:"+c;</script>`;
    await upload(page, "throw-calc.html", "text/html", html);
    await page.getByRole("link", { name: `Open tool E2E tool ${p}` }).click();
    await expect(page.frameLocator("iframe").getByRole("heading")).toHaveText("Hello from the tool / cookie:blocked");

    // A file keeps its versions, newest first; a member cannot delete them.
    await newApp(page, `E2E file ${p}`, "File to download");
    await upload(page, `e2e-${p}-1.txt`, "text/plain", "one", "1.0");
    await upload(page, `e2e-${p}-2.txt`, "text/plain", "two", "1.1");
    await expect(page.getByRole("listitem").first()).toContainText("1.1");
    await expect(page.getByRole("listitem").first()).toContainText("Newest");
    await expect(page.getByRole("button", { name: "Delete 1.0" })).toHaveCount(0);
    const fileUrl = page.url();

    // The list groups by "E2E" and offers the newest download.
    await page.goto(`/apps?q=${encodeURIComponent(`E2E file ${p}`)}`);
    const download = page.getByRole("link", { name: `Download E2E file ${p}` });
    expect(await (await page.request.get((await download.getAttribute("href"))!)).text()).toBe("two");

    // An admin deletes the old version.
    const admin = await adminPage(browser);
    admin.on("dialog", (d) => d.accept());
    await admin.goto(fileUrl);
    await admin.getByRole("button", { name: "Delete 1.0" }).click();
    await expect(admin.getByRole("link", { name: "Download 1.0" })).toHaveCount(0);
    await expect(admin.getByRole("link", { name: "Download 1.1" })).toBeVisible();
  });
});

async function adminPage(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, "admin@vertigo.test");
  return page;
}
