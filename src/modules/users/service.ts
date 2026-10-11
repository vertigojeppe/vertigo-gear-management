import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { Actor } from "@/lib/auth/session";
import { isRole, type Role } from "../../../config/app.config";
import type { UserInput } from "./schema";

export class UserError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "UserError";
  }
}

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  googleEmail: string | null;
  active: boolean;
  createdAt: Date;
};

function toPublic(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  googleEmail: string | null;
  active: boolean;
  createdAt: Date;
}): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: isRole(u.role) ? u.role : "viewer",
    phone: u.phone,
    googleEmail: u.googleEmail,
    active: u.active,
    createdAt: u.createdAt,
  };
}

export const users = {
  async findByEmail(email: string): Promise<PublicUser | null> {
    const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return u ? toPublic(u) : null;
  },

  async get(id: string): Promise<PublicUser | null> {
    const u = await prisma.user.findUnique({ where: { id } });
    return u ? toPublic(u) : null;
  },

  async list(): Promise<PublicUser[]> {
    const rows = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
    return rows.map(toPublic);
  },

  /** Returns the user when email + password match an active account. */
  async verifyCredentials(email: string, password: string): Promise<PublicUser | null> {
    const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!u || !u.active || !u.passwordHash) return null;
    const ok = await verifyPassword(password, u.passwordHash);
    return ok ? toPublic(u) : null;
  },

  async create(actor: Actor, input: UserInput & { password: string }): Promise<PublicUser> {
    assertCan(actor, "users.manage");
    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new UserError("A user with that email already exists.", "email");
    const u = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        phone: input.phone ?? null,
        googleEmail: input.googleEmail ?? null,
        active: input.active,
        passwordHash: await hashPassword(input.password),
      },
    });
    await logActivity(actor, { entityType: "user", entityId: u.id, action: "created", summary: `Created user ${u.name} (${u.role})` });
    return toPublic(u);
  },

  async update(actor: Actor, id: string, input: UserInput): Promise<PublicUser> {
    assertCan(actor, "users.manage");
    const before = await prisma.user.findUniqueOrThrow({ where: { id } });
    if (before.id === actor.id && (input.role !== "admin" || !input.active)) {
      throw new UserError("You cannot remove your own admin access.", "role");
    }
    const clash = await prisma.user.findUnique({ where: { email: input.email } });
    if (clash && clash.id !== id) throw new UserError("A user with that email already exists.", "email");
    const u = await prisma.user.update({
      where: { id },
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        phone: input.phone ?? null,
        googleEmail: input.googleEmail ?? null,
        active: input.active,
      },
    });
    await logActivity(actor, {
      entityType: "user",
      entityId: u.id,
      action: "updated",
      summary: `Updated user ${u.name}`,
      details: { role: { from: before.role, to: u.role }, active: { from: before.active, to: u.active } },
    });
    return toPublic(u);
  },

  async setPassword(actor: Actor, id: string, password: string) {
    if (actor.id !== id) assertCan(actor, "users.manage");
    await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
    await logActivity(actor, { entityType: "user", entityId: id, action: "password_set", summary: actor.id === id ? "Changed own password" : "Reset password" });
  },

  async changeOwnPassword(actor: Actor, current: string, password: string) {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (!u.passwordHash || !(await verifyPassword(current, u.passwordHash))) {
      throw new UserError("Current password is wrong.", "current");
    }
    await users.setPassword(actor, actor.id, password);
  },
};

/* ------------------------------------------------------------------------ */
/* API tokens                                                               */
/* ------------------------------------------------------------------------ */

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const apiTokens = {
  async listFor(userId: string) {
    return prisma.apiToken.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true } });
  },

  /** Creates a token for the actor. The plaintext is returned once. */
  async create(actor: Actor, name: string): Promise<{ id: string; token: string }> {
    const token = "vg_" + randomBytes(24).toString("base64url");
    const row = await prisma.apiToken.create({
      data: { userId: actor.id, name, tokenHash: hashToken(token), prefix: token.slice(0, 8) },
    });
    await logActivity(actor, { entityType: "user", entityId: actor.id, action: "api_token_created", summary: `Created API token "${name}"` });
    return { id: row.id, token };
  },

  async revoke(actor: Actor, id: string) {
    const row = await prisma.apiToken.findUniqueOrThrow({ where: { id } });
    if (row.userId !== actor.id) assertCan(actor, "users.manage");
    await prisma.apiToken.delete({ where: { id } });
    await logActivity(actor, { entityType: "user", entityId: row.userId, action: "api_token_revoked", summary: `Revoked API token "${row.name}"` });
  },

  /** Resolve a bearer token to an actor, or null. */
  async resolve(token: string): Promise<Actor | null> {
    const row = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!row || !row.user.active) return null;
    prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    return { id: row.user.id, email: row.user.email, name: row.user.name, role: isRole(row.user.role) ? row.user.role : "viewer" };
  },
};
