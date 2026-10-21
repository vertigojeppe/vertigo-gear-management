import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { glossary } from "../glossary";

/**
 * Settings › Search words against the dev/CI database. Saving replaces the
 * whole list, so this keeps every existing group while it runs (other
 * tests search with them) and puts the original text back afterwards.
 */
const marker = `gl${Date.now().toString(36)}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
const member: Actor = { id: "", email: "", name: "Test Member", role: "member" };
let original = "";

beforeAll(async () => {
  admin.id = (await prisma.user.findFirstOrThrow({ where: { role: "admin" } })).id;
  original = await glossary.text();
});

afterAll(async () => {
  if (original) await glossary.save(admin, original);
  await prisma.activityLog.deleteMany({ where: { action: "glossary_saved", userId: admin.id, createdAt: { gte: new Date(Date.now() - 600_000) } } });
  await prisma.$disconnect();
});

describe("search words", () => {
  it("is edited by settings managers only, and refuses lines with one word", async () => {
    await expect(glossary.save(member, original)).rejects.toThrow();
    await expect(glossary.save(admin, `${original}\nsolo${marker}`)).rejects.toThrow(/line \d+/);
  });

  it("saves the text as groups and serves them to the searches", async () => {
    const r = await glossary.save(admin, `${original}\n\nfoo${marker}, bar${marker}`);
    expect(r.count).toBe(original.split("\n").filter(Boolean).length + 1);
    expect(await glossary.text()).toContain(`foo${marker}, bar${marker}`);
  });
});
