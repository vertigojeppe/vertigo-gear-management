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

  test("the page declares the manifest and the iOS home-screen icon", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveCount(1);
  });
});
