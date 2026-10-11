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
