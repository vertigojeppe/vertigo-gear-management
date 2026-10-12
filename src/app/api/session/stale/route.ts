import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "@/lib/auth";
import { requestOrigin } from "@/lib/request-origin";

/**
 * Clears a session cookie whose user no longer exists (deleted, deactivated,
 * or the database was reset) and sends the visitor to the login page.
 * `requireActor` redirects here; see src/lib/auth/session.ts.
 */
export async function GET(req: NextRequest) {
  await signOut({ redirect: false });
  return NextResponse.redirect(`${requestOrigin(req)}/login?stale=1`);
}
