import { ROLES, type Permission, type Role } from "../../../config/app.config";

/**
 * True when the role grants the permission.
 * Pure and dependency-free so it can be unit-tested and used anywhere
 * (server, client components, tests) without pulling in Auth.js.
 */
export function can(role: Role, permission: Permission): boolean {
  return (ROLES[role].permissions as readonly Permission[]).includes(permission);
}

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

/** Throws ForbiddenError unless the role has the permission. */
export function assertCan(actor: { role: Role }, permission: Permission): void {
  if (!can(actor.role, permission)) throw new ForbiddenError(permission);
}
