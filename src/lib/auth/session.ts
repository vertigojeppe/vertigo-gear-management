import { redirect } from "next/navigation";
import { cache } from "react";
import { isRole, type Permission, type Role } from "../../../config/app.config";
import { prisma } from "@/lib/db";
import { auth } from "./index";
import { can, ForbiddenError } from "./permissions";

export { can, ForbiddenError };

export type Actor = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

/**
 * Session cookie → actor, checked against the User table once per request.
 * The JWT only proves who signed in; name, role and "still exists / still
 * active" come from the database, so a deleted or deactivated user, or a
 * cookie from before a database reset, is treated as signed out.
 */
const resolve = cache(async (): Promise<{ hasSession: boolean; actor: Actor | null }> => {
  const session = await auth();
  if (!session?.user?.id) return { hasSession: false, actor: null };
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, name: true, role: true, active: true } });
  if (!user || !user.active) return { hasSession: true, actor: null };
  return { hasSession: true, actor: { id: user.id, email: user.email, name: user.name, role: isRole(user.role) ? user.role : "viewer" } };
});

/** Current actor or null. Cached per request. */
export const getActor = cache(async (): Promise<Actor | null> => (await resolve()).actor);

/**
 * Redirects to /login when nobody is signed in. A session whose user no
 * longer exists is sent through /api/session/stale, which clears the cookie
 * first (otherwise the proxy would bounce /login straight back to the app).
 */
export async function requireActor(): Promise<Actor> {
  const { hasSession, actor } = await resolve();
  if (!actor) redirect(hasSession ? "/api/session/stale" : "/login");
  return actor;
}

/** Use in server actions and services: throws when the actor lacks the permission. */
export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await requireActor();
  if (!can(actor.role, permission)) throw new ForbiddenError(permission);
  return actor;
}
