import os from "node:os";
import type { NextRequest } from "next/server";

/**
 * The origin the client used to reach us (scheme + host), taken from the
 * request headers. `req.nextUrl.origin` cannot be used for this: the dev
 * server reports its own hostname (localhost) regardless of how the request
 * arrived, which sends phones on the local network to the wrong address.
 * Honours a reverse proxy's X-Forwarded-* headers.
 */
export function requestOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\])$/i;

/**
 * For URLs that other devices must open (QR codes): if the page was opened
 * on localhost, swap in this machine's first LAN IPv4 address, keeping the
 * scheme and port. A phone can then follow a QR shown on the PC screen.
 * Returns the origin unchanged when it is not local or no LAN address exists.
 */
export function shareableOrigin(origin: string): string {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return origin;
  }
  if (!LOCAL_HOSTS.test(url.hostname)) return origin;
  const lan = lanIPv4();
  if (!lan) return origin;
  url.hostname = lan;
  return url.origin;
}

function lanIPv4(): string | null {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254.")) return a.address;
    }
  }
  return null;
}

/**
 * Origin for absolute URLs the app hands out (API docs base, links in
 * feeds): APP_URL when it points at a real address, otherwise the origin
 * the request came in on, so dev and LAN setups get something that works.
 */
export function publicOrigin(req: NextRequest): string {
  const configured = (process.env.APP_URL ?? "").replace(/\/$/, "");
  if (configured) {
    try {
      if (!LOCAL_HOSTS.test(new URL(configured).hostname)) return configured;
    } catch {
      /* fall through */
    }
  }
  return requestOrigin(req);
}
