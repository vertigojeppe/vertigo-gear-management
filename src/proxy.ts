import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requestOrigin } from "@/lib/request-origin";

/**
 * Optimistic auth check: redirects anonymous visitors to /login.
 * This only decodes the session cookie. Real authorisation happens in
 * requireActor / requirePermission inside pages, actions and API routes.
 *
 * Redirect targets are built from the request's Host header (not
 * req.nextUrl.origin) so they work from any hostname the app is reached on:
 * localhost, a LAN address during phone testing, or the public domain.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  // API routes authenticate themselves (Bearer token or session) and must
  // answer 401 instead of redirecting to the login page.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // The manifest, the service worker and the offline page must load without a session: the
  // phone fetches them while installing and when the network is gone.
  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/share/") || pathname === "/offline" || pathname === "/sw.js" || pathname === "/manifest.webmanifest";
  const origin = requestOrigin(req);

  if (!req.auth && !isPublic) {
    const next = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(`${origin}/login${next}`);
  }
  if (req.auth && pathname.startsWith("/login")) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
