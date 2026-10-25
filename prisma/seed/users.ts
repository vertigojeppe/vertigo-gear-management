import type { PrismaClient } from "../../src/generated/prisma/client";
import { hashPassword } from "../../src/lib/auth/password";

/**
 * Demo users. The password for all of them comes from SEED_PASSWORD
 * (default "vertigo123"). Change it before exposing a seeded instance.
 */
export const SEED_USERS = [
  { email: "admin@vertigo.test", name: "Alex Admin", role: "admin" },
  { email: "member@vertigo.test", name: "Mette Member", role: "member" },
  { email: "viewer@vertigo.test", name: "Viggo Viewer", role: "viewer" },
  { email: "screen@vertigo.test", name: "Office Screen", role: "display" },
] as const;

export async function seedUsers(prisma: PrismaClient) {
  const password = process.env.SEED_PASSWORD ?? "vertigo123";
  const passwordHash = await hashPassword(password);
  const results = [];
  for (const u of SEED_USERS) {
    results.push(
      await prisma.user.upsert({
        where: { email: u.email },
        update: { name: u.name, role: u.role, passwordHash, active: true },
        create: { ...u, passwordHash },
      }),
    );
  }
  return results;
}
