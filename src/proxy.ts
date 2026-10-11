import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Optimistic auth check: redirects anonymous visitors to /login.
 * This only decodes the session cookie. Real authorisation happens in
 * requireActor / requirePermission inside pages, actions and API routes.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  // API routes authenticate themselves (Bearer token or session) and must
  // answer 401 instead of redirecting to the login page.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/share/");

  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (req.auth && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
