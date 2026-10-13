/* Service worker for the installed app.
 *
 * Pages are always fetched from the network (everything is live data behind
 * login); when the network is gone, navigations fall back to /offline.
 * Hashed build assets (/_next/static) and the icons are cached on first use
 * so the shell paints quickly on a poor warehouse signal. Nothing else is
 * cached: API responses, uploads and PDFs must never be served stale.
 */
const VERSION = "v1";
const SHELL = `vg-shell-${VERSION}`;
const ASSETS = `vg-assets-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isAsset(url) {
  return url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())));
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
