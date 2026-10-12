import { expect, test, type Page } from "@playwright/test";

// A browser with no WebGL context, as on a locked-down laptop or a remote
// desktop. launchOptions is worker-scoped, so this lives in its own file.
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-3d-apis", "--disable-gpu"] } });

const password = process.env.SEED_PASSWORD ?? "vertigo123";
const stamp = Date.now().toString(36);

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("a 3D document shows a fallback card and the page keeps working without WebGL", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page, "admin@vertigo.test");
  await page.goto("/projects/new");
  await page.getByLabel("Name", { exact: true }).fill(`E2E show ${stamp} nogl`);
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByRole("button", { name: "Create plan" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/plan$/);

  const stl = Buffer.from("solid t\nfacet normal 0 0 1\n outer loop\n  vertex 0 0 0\n  vertex 1 0 0\n  vertex 1 1 0\n endloop\nendfacet\nendsolid t\n");
  await page.getByLabel("Upload files").setInputFiles({ name: `tri-${stamp}.stl`, mimeType: "model/stl", buffer: stl });
  await page.getByRole("link", { name: new RegExp(`tri-${stamp}.stl`) }).click();

  await expect(page.getByRole("heading", { name: `tri-${stamp}.stl` })).toBeVisible();
  const card = page.getByTestId("model-fallback");
  await expect(card).toBeVisible();
  await expect(card.getByText(/3D preview needs WebGL/)).toBeVisible();
  await expect(card.getByRole("link", { name: "Download" })).toHaveAttribute("href", /download=1/);
  await expect(page.locator("canvas")).toHaveCount(0);
  // The rest of the page still works: versions list and pin form are there.
  await expect(page.getByRole("heading", { name: "Versions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pinned to" })).toBeVisible();
  expect(errors.filter((e) => /WebGL/.test(e))).toEqual([]);
});
