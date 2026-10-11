import type { NextRequest } from "next/server";
import { getActor, type Actor } from "@/lib/auth/session";
import { apiTokens } from "@/modules/users";

/**
 * Resolve the caller of a REST request: a per-user Bearer token, or the
 * browser session (so the UI can call the same endpoints).
 */
export async function apiActor(req: NextRequest): Promise<Actor | null> {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return apiTokens.resolve(header.slice(7).trim());
  }
  return getActor();
}
