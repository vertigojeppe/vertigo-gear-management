import { redirect } from "next/navigation";
import { cache } from "react";
import type { Permission, Role } from "../../../config/app.config";
import { auth } from "./index";
import { can, ForbiddenError } from "./permissions";

export { can, ForbiddenError };

export type Actor = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

/** Current actor or null. Cached per request. */
export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: session.user.role,
  };
});

/** Redirects to /login when nobody is signed in. Use in pages and layouts. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}

/** Use in server actions and services: throws when the actor lacks the permission. */
export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await requireActor();
  if (!can(actor.role, permission)) throw new ForbiddenError(permission);
  return actor;
}
