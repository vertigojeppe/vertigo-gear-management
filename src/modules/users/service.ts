import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { isRole, type Role } from "../../../config/app.config";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
};

function toPublic(u: { id: string; email: string; name: string; role: string; active: boolean }): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: isRole(u.role) ? u.role : "viewer",
    active: u.active,
  };
}

export const users = {
  async findByEmail(email: string): Promise<PublicUser | null> {
    const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return u ? toPublic(u) : null;
  },

  async list(): Promise<PublicUser[]> {
    const rows = await prisma.user.findMany({ orderBy: { name: "asc" } });
    return rows.map(toPublic);
  },

  /** Returns the user when email + password match an active account. */
  async verifyCredentials(email: string, password: string): Promise<PublicUser | null> {
    const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!u || !u.active || !u.passwordHash) return null;
    const ok = await verifyPassword(password, u.passwordHash);
    return ok ? toPublic(u) : null;
  },
};
