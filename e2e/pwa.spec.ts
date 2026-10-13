import { expect, test } from "@playwright/test";

/** The bits a phone fetches while installing must work without a session. */
test.describe("installable app", () => {
  test("manifest, service worker and offline page are public", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    const m = (await manifest.json()) as { name: string; display: string; start_url: string; icons: { src: string }[] };
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/dashboard");
    for (const icon of m.icons) expect((await request.get(icon.src)).status(), icon.src).toBe(200);

    const sw = await request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(sw.headers()["content-type"]).toContain("javascript");
    expect(await sw.text()).toContain("/offline");

    const offline = await request.get("/offline");
    expect(offline.status()).toBe(200);
    expect(await offline.text()).toContain("offline");
  });

  test("the service worker installs and caches the offline page", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "service workers are observable in Chromium only");
    await page.goto("/login");
    // Registered by hand: the layout only registers it in production builds (where it may already have done so).
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
    });
    await expect.poll(() => context.serviceWorkers().length).toBeGreaterThan(0);
    expect(context.serviceWorkers()[0].url()).toContain("/sw.js");
    await expect.poll(async () => page.evaluate(async () => (await caches.keys()).some((k) => k.startsWith("vg-shell")))).toBe(true);
    await expect.poll(async () => page.evaluate(async () => Boolean(await caches.match("/offline")))).toBe(true);
  });

  test("a packing list that was opened stays readable offline", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "service workers are observable in Chromium only");
    await page.goto("/login");
    await page.getByLabel("Email").fill("member@vertigo.test");
    await page.getByLabel("Password").fill(process.env.SEED_PASSWORD ?? "vertigo123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
    });
    await expect.poll(() => context.serviceWorkers().length).toBeGreaterThan(0);

    // A list of our own on a throwaway project.
    const stamp = Date.now().toString(36);
    await page.goto("/projects/new");
    await page.getByLabel("Name").fill(`E2E show offline ${stamp}`);
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("link", { name: "New packing list" }).click();
    await page.getByLabel("Name").fill(`Basement ${stamp}`);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: `Basement ${stamp}` })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`Basement ${stamp} · E2E show offline ${stamp}`));
    // Loaded through the worker once so it is saved (the first load after registering can bypass it).
    await page.reload();
    await expect(page.getByRole("heading", { name: `Basement ${stamp}` })).toBeVisible();
    const listUrl = page.url();
    await expect.poll(async () => page.evaluate(async () => (await (await fetch("/__offline-index")).json()).length)).toBeGreaterThan(0);

    await context.setOffline(true);
    await page.goto(listUrl);
    await expect(page.getByRole("heading", { name: `Basement ${stamp}` })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`Basement ${stamp}`) })).toBeVisible();
    await context.setOffline(false);
  });

  test("the page declares the manifest and the iOS home-screen icon", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveCount(1);
  });
});
