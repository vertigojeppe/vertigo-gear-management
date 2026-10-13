/* Service worker for the installed app.
 *
 * Pages are fetched from the network (everything is live data behind login).
 * Packing lists are the exception people need in a basement with no signal:
 * every packing list page and PDF that was opened is kept, and served when
 * the network fails. Everything else falls back to /offline, which lists the
 * saved packing lists. Hashed build assets (/_next/static) and the icons are
 * cached on first use so the shell paints quickly. API responses and uploads
 * are never cached.
 */
const VERSION = "v2";
const SHELL = `vg-shell-${VERSION}`;
const ASSETS = `vg-assets-${VERSION}`;
const PAGES = `vg-pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const INDEX_URL = "/__offline-index";
const MAX_SAVED_LISTS = 20;

const PACKING_PAGE = /^\/projects\/[^/]+\/packing\/[^/]+$/;
const PACKING_PDF = /^\/api\/packing\/[^/]+\/list\.pdf$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      await shell.addAll([OFFLINE_URL, "/icons/icon-192.png"]);
      // The offline page's own scripts and styles too, so its saved-lists section renders with no network at all.
      try {
        const html = await (await shell.match(OFFLINE_URL)).text();
        const urls = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]))];
        const assets = await caches.open(ASSETS);
        await Promise.all(urls.map((u) => assets.add(u).catch(() => undefined)));
      } catch {
        /* the page still works online; offline it falls back to the plain text */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, ASSETS, PAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isAsset(url) {
  return url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"));
}

/** The saved packing lists, newest first: { url, title, savedAt }[]. Kept as a JSON response in the pages cache. */
async function readIndex(cache) {
  const res = await cache.match(INDEX_URL);
  if (!res) return [];
  try {
    return await res.json();
  } catch {
    return [];
  }
}

async function writeIndex(cache, entries) {
  await cache.put(INDEX_URL, new Response(JSON.stringify(entries), { headers: { "Content-Type": "application/json" } }));
}

/** Remember a packing list page: the HTML itself, plus its title in the index; the oldest beyond MAX_SAVED_LISTS go. */
async function savePage(request, response) {
  const cache = await caches.open(PAGES);
  const html = await response.clone().text();
  const m = html.match(/<title>([^<]*)<\/title>/i);
  const title = m ? m[1].replace(/\s*·\s*[^·]*$/, "").trim() : request.url;
  await cache.put(request.url, response);
  const url = new URL(request.url).pathname;
  const entries = [{ url, title, savedAt: Date.now() }, ...(await readIndex(cache)).filter((e) => e.url !== url)];
  for (const old of entries.splice(MAX_SAVED_LISTS)) {
    await cache.delete(new URL(old.url, self.location.origin).href);
    await cache.delete(new URL(`/api/packing/${old.url.split("/").pop()}/list.pdf`, self.location.origin).href);
  }
  await writeIndex(cache, entries);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === INDEX_URL) {
    event.respondWith(caches.open(PAGES).then((cache) => cache.match(INDEX_URL).then((r) => r || new Response("[]", { headers: { "Content-Type": "application/json" } }))));
    return;
  }

  if (request.mode === "navigate") {
    const packing = PACKING_PAGE.test(url.pathname) && !url.search;
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Only a real page for a signed-in user is worth keeping (a redirect to /login is not).
          if (packing && res.ok && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")) savePage(request, res.clone()).catch(() => undefined);
          return res;
        })
        .catch(async () => (await caches.match(request.url)) || (await caches.match(OFFLINE_URL)) || Response.error()),
    );
    return;
  }

  if (PACKING_PDF.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(PAGES).then((cache) => cache.put(request, res.clone())).catch(() => undefined);
          return res;
        })
        .catch(async () => (await caches.match(request)) || Response.error()),
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      caches.match(request).then((hit) => {
        if (hit) return hit;
        return fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(ASSETS).then((cache) => cache.put(request, copy));
          }
          return res;
        });
      }),
    );
  }
});
