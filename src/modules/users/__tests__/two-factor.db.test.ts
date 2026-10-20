import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { totpCode, totpStep } from "@/lib/auth/totp";
import { twoFactor } from "../two-factor";
import { users } from "../service";

/**
 * Two-factor sign-in against the dev/CI database: setup confirms with a
 * code, every code and recovery code works once, admins cannot turn it
 * off, and an admin reset clears it.
 */
const marker = `tf-${Date.now().toString(36)}`;
let member: Actor;
let admin: Actor;

beforeAll(async () => {
  vi.stubEnv("TWO_FACTOR_REQUIRED_ROLES", "admin");
  const m = await prisma.user.create({ data: { email: `${marker}-m@vertigo.test`, name: `Member ${marker}`, role: "member", passwordHash: "x" } });
  const a = await prisma.user.create({ data: { email: `${marker}-a@vertigo.test`, name: `Admin ${marker}`, role: "admin", passwordHash: "x" } });
  member = { id: m.id, email: m.email, name: m.name, role: "member" };
  admin = { id: a.id, email: a.email, name: a.name, role: "admin" };
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.activityLog.deleteMany({ where: { OR: [{ entityId: { in: [member.id, admin.id] } }, { userId: { in: [member.id, admin.id] } }] } });
  await prisma.user.deleteMany({ where: { id: { in: [member.id, admin.id] } } });
  await prisma.$disconnect();
});

const now = () => totpStep();

describe("two-factor sign-in", () => {
  let secret: string;
  let codes: string[];

  it("turns on only when a code from the app matches the new secret", async () => {
    const setup = twoFactor.begin(member);
    secret = setup.secret;
    expect(setup.url).toContain(encodeURIComponent(member.email));
    await expect(twoFactor.confirm(member, setup.sealed, "000000")).rejects.toThrow(/does not match/);
    await expect(twoFactor.confirm(admin, setup.sealed, totpCode(secret, now()))).rejects.toThrow(/expired/); // sealed for someone else
    expect((await twoFactor.status(member.id)).enabled).toBe(false);
    codes = await twoFactor.confirm(member, setup.sealed, totpCode(secret, now() - 1));
    expect(codes).toHaveLength(10);
    expect(await twoFactor.status(member.id)).toMatchObject({ enabled: true, recoveryLeft: 10, required: false });
    expect((await users.get(member.id))?.twoFactor).toBe(true);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(row.totpSecret).not.toContain(secret);
  });

  it("accepts each app code once", async () => {
    const code = totpCode(secret, now());
    expect(await twoFactor.verify(member.id, code)).toBe(true);
    expect(await twoFactor.verify(member.id, code)).toBe(false);
    expect(await twoFactor.verify(member.id, "123456")).toBe(code === "123456");
  });

  it("accepts each recovery code once", async () => {
    expect(await twoFactor.verify(member.id, codes[0].toUpperCase())).toBe(true);
    expect(await twoFactor.verify(member.id, codes[0])).toBe(false);
    expect((await twoFactor.status(member.id)).recoveryLeft).toBe(9);
    const fresh = await twoFactor.regenerateRecoveryCodes(member, codes[1]);
    expect(await twoFactor.verify(member.id, codes[2])).toBe(false); // old set gone
    expect(await twoFactor.verify(member.id, fresh[0])).toBe(true);
  });

  it("lets a member turn it off with a code, never an admin", async () => {
    await expect(twoFactor.disable(member, "nope-nope")).rejects.toThrow(/does not match/);
    await twoFactor.disable(member, totpCode(secret, now() + 1));
    expect((await twoFactor.status(member.id)).enabled).toBe(false);

    const setup = twoFactor.begin(admin);
    const adminCodes = await twoFactor.confirm(admin, setup.sealed, totpCode(setup.secret, now()));
    await expect(twoFactor.disable(admin, adminCodes[0])).rejects.toThrow(/required/);
    expect((await twoFactor.status(admin.id)).required).toBe(true);
  });

  it("is cleared by an admin reset (lost phone)", async () => {
    await expect(twoFactor.reset(member, admin.id)).rejects.toThrow();
    await twoFactor.reset(admin, admin.id);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect([row.totpSecret, row.totpEnabledAt, row.recoveryCodes]).toEqual([null, null, []]);
    expect(await twoFactor.verify(admin.id, "abcd-efgh")).toBe(false);
  });
});
