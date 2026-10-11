import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Optimistic auth check: redirects anonymous visitors to /login.
 * This only decodes the session cookie. Real authorisation happens in
 * requireActor / requirePermission inside pages, actions and API routes.
 *
 * Redirects are relative so they work from any hostname the app is
 * reached on (localhost, a LAN address, the public domain).
 */
function redirectTo(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  // API routes authenticate themselves (Bearer token or session) and must
  // answer 401 instead of redirecting to the login page.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/share/");

  if (!req.auth && !isPublic) {
    const next = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return redirectTo(`/login${next}`);
  }
  if (req.auth && pathname.startsWith("/login")) {
    return redirectTo("/dashboard");
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
