import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
// eslint-disable-next-line no-restricted-imports
import { crewOptions } from "@/modules/projects/queries";
// eslint-disable-next-line no-restricted-imports
import { entryPeopleOptions } from "@/modules/agenda/queries";
// eslint-disable-next-line no-restricted-imports
import { personOptions } from "@/modules/contacts/queries";
import { users } from "../service";

/** A hidden user (API-token and other extra accounts) is left out of every people picker. */
const marker = `hid-${Date.now().toString(36)}`;
let admin: Actor;
let extraId: string;

beforeAll(async () => {
  // Stored as viewers: parallel DB tests pick "any admin" / "any member".
  const a = await prisma.user.create({ data: { email: `${marker}-a@vertigo.test`, name: `Admin ${marker}`, role: "viewer", passwordHash: "x" } });
  const x = await prisma.user.create({ data: { email: `${marker}-x@vertigo.test`, name: `Extra ${marker}`, role: "viewer", passwordHash: "x" } });
  admin = { id: a.id, email: a.email, name: a.name, role: "admin" };
  extraId = x.id;
});

afterAll(async () => {
  await prisma.activityLog.deleteMany({ where: { OR: [{ entityId: { in: [admin.id, extraId] } }, { userId: { in: [admin.id, extraId] } }] } });
  await prisma.user.deleteMany({ where: { id: { in: [admin.id, extraId] } } });
  await prisma.$disconnect();
});

const ids = async () => ({
  crew: (await crewOptions()).map((u) => u.id),
  entry: (await entryPeopleOptions()).map((u) => u.id),
  person: (await personOptions()).users.map((u) => u.id),
});

describe("hidden users", () => {
  it("drops out of the pickers once hidden, and stays able to sign in", async () => {
    const before = await ids();
    expect([before.crew, before.entry, before.person].every((l) => l.includes(extraId))).toBe(true);

    const u = await users.update(admin, extraId, { email: `${marker}-x@vertigo.test`, name: `Extra ${marker}`, role: "viewer", active: true, hidden: true });
    expect(u.hidden).toBe(true);
    expect(u.active).toBe(true);

    const after = await ids();
    expect([after.crew, after.entry, after.person].some((l) => l.includes(extraId))).toBe(false);
    expect(after.crew).toContain(admin.id);
  });
});
