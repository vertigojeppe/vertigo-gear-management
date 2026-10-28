import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_PASSWORD ?? "vertigo123";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/**
 * How far the page is wider than the screen, and what sticks out. The app
 * shell scrolls in a box with overflow-y: auto, which also scrolls sideways
 * when anything is too wide; boxes that scroll sideways on purpose (tables,
 * the calendar timeline) are fine.
 */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const scroller = document.querySelector("main")?.parentElement;
    if (!scroller) return { px: 0, offenders: [] as string[] };
    const vw = scroller.clientWidth;
    const scrollsItself = (el: Element) => {
      for (let p = el.parentElement; p && p !== scroller; p = p.parentElement) if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(p).overflowX)) return true;
      return false;
    };
    const offenders: string[] = [];
    for (const el of document.querySelectorAll("main *")) {
      if (el.getBoundingClientRect().right <= vw + 1 || scrollsItself(el)) continue;
      if (offenders.length < 3) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 4).join(".")} «${(el.textContent ?? "").trim().slice(0, 40)}»`);
    }
    return { px: scroller.scrollWidth - scroller.clientWidth, offenders };
  });
}

/** The first link on a list page that matches, so detail pages are checked with whatever data exists. */
async function firstLink(page: Page, list: string, href: RegExp) {
  await page.goto(list);
  const links = await page.locator("main a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  return links.find((l) => href.test(l)) ?? null;
}

test.describe("phone width", () => {
  test.skip(({ isMobile }) => !isMobile, "phones only");
  // A small Android phone, narrower than the Pixel the phone project uses.
  test.use({ viewport: { width: 360, height: 780 } });

  test("no page scrolls sideways", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "admin@vertigo.test");
    const pages = ["/dashboard", "/inventory", "/inventory/items", "/inventory/categories", "/inventory/locations", "/inventory/wishlist", "/inventory/subhire", "/projects", "/projects/clients", "/projects/packing-templates", "/projects/plan-templates", "/rentals", "/calendar", "/contacts", "/apps", "/settings", "/settings/users", "/settings/custom-fields", "/settings/pricing"];
    const details: [string, RegExp][] = [
      ["/inventory", /^\/inventory\/models\/[^/]+$/],
      ["/inventory/items", /^\/inventory\/items\/[^/]+$/],
      ["/projects", /^\/projects\/(?!new|clients|packing-templates|plan-templates)[^/]+$/],
      ["/rentals", /^\/rentals\/(?!new)[^/]+$/],
      ["/contacts", /^\/contacts\/[^/]+$/],
      ["/projects/plan-templates", /^\/projects\/plan-templates\/[^/]+$/],
      ["/projects/packing-templates", /^\/projects\/packing-templates\/[^/]+$/],
    ];
    for (const [list, href] of details) {
      const link = await firstLink(page, list, href);
      if (link) pages.push(link);
    }
    const project = pages.find((p) => /^\/projects\/(?!clients|packing-templates|plan-templates)[^/]+$/.test(p));
    if (project) {
      const list = await firstLink(page, project, /\/packing\/(?!new)[^/]+$/);
      if (list) pages.push(list);
      pages.push(`${project}/plan`);
    }

    const wide: string[] = [];
    for (const path of pages) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      const r = await overflow(page);
      if (r.px > 1) wide.push(`${path}: ${r.px}px wider (${r.offenders.join(", ")})`);
    }
    expect(wide, "pages that scroll sideways on a 360 px phone").toEqual([]);
  });
});
