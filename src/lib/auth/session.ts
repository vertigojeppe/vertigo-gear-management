import { redirect } from "next/navigation";
import { cache } from "react";
import { isRole, type Permission, type Role } from "../../../config/app.config";
import { prisma } from "@/lib/db";
import { auth } from "./index";
import { can, ForbiddenError } from "./permissions";
import { twoFactorRequired } from "./two-factor";

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
 * A user whose role requires 2FA (TWO_FACTOR_REQUIRED_ROLES) but who has
 * not set it up yet is signed in for the setup page only.
 */
const resolve = cache(async (): Promise<{ hasSession: boolean; actor: Actor | null; needsTwoFactorSetup: boolean }> => {
  const session = await auth();
  if (!session?.user?.id) return { hasSession: false, actor: null, needsTwoFactorSetup: false };
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, name: true, role: true, active: true, totpEnabledAt: true } });
  if (!user || !user.active) return { hasSession: true, actor: null, needsTwoFactorSetup: false };
  const actor: Actor = { id: user.id, email: user.email, name: user.name, role: isRole(user.role) ? user.role : "viewer" };
  return { hasSession: true, actor, needsTwoFactorSetup: !user.totpEnabledAt && twoFactorRequired(actor.role) };
});

/** Current actor or null (also null while a required 2FA setup is pending). Cached per request. */
export const getActor = cache(async (): Promise<Actor | null> => {
  const { actor, needsTwoFactorSetup } = await resolve();
  return needsTwoFactorSetup ? null : actor;
});

/**
 * Redirects to /login when nobody is signed in. A session whose user no
 * longer exists is sent through /api/session/stale, which clears the cookie
 * first (otherwise the proxy would bounce /login straight back to the app).
 */
export async function requireActor(): Promise<Actor> {
  const { hasSession, actor, needsTwoFactorSetup } = await resolve();
  if (!actor) redirect(hasSession ? "/api/session/stale" : "/login");
  if (needsTwoFactorSetup) redirect("/two-factor");
  return actor;
}

/** The 2FA setup page only: the signed-in user, even while their required setup is pending. */
export async function requireActorForTwoFactorSetup(): Promise<{ actor: Actor; required: boolean }> {
  const { hasSession, actor, needsTwoFactorSetup } = await resolve();
  if (!actor) redirect(hasSession ? "/api/session/stale" : "/login");
  return { actor, required: needsTwoFactorSetup };
}

/** Use in server actions and services: throws when the actor lacks the permission. */
export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await requireActor();
  if (!can(actor.role, permission)) throw new ForbiddenError(permission);
  return actor;
}
