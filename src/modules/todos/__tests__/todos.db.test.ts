import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { todos } from "../service";

/** Personal to-dos against the dev/CI database: order, done/reopen, and that nobody reaches another person's list. */
const marker = `todo${Date.now().toString(36)}`;
const me: Actor = { id: "", email: "", name: "Todo Me", role: "member" };
const other: Actor = { id: "", email: "", name: "Todo Other", role: "admin" };

beforeAll(async () => {
  // Viewers in the database (parallel tests pick "any admin / member"); the roles above act in memory only.
  for (const a of [me, other]) a.id = (await prisma.user.create({ data: { email: `${marker}-${a.name.split(" ")[1].toLowerCase()}@vertigo.test`, name: a.name, passwordHash: "x", role: "viewer" } })).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [me.id, other.id] } } }); // to-dos go with their user
  await prisma.$disconnect();
});

describe("todos", () => {
  it("keeps open ones in written order and done ones newest first", async () => {
    const a = await todos.add(me, "  Order gaffa  ");
    const b = await todos.add(me, "Call the venue");
    expect(a.text).toBe("Order gaffa");
    await todos.setDone(me, a.id, true);
    let lists = await todos.list(me.id);
    expect(lists.open.map((r) => r.id)).toEqual([b.id]);
    expect(lists.done.map((r) => r.id)).toEqual([a.id]);
    await todos.setDone(me, a.id, false);
    lists = await todos.list(me.id);
    expect(lists.open.map((r) => r.id)).toEqual([a.id, b.id]);
    await expect(todos.add(me, "   ")).rejects.toThrow();
  });

  it("never shows or changes someone else's list, admins included", async () => {
    const mine = await todos.add(me, "Private note");
    expect((await todos.list(other.id)).open).toEqual([]);
    await expect(todos.setDone(other, mine.id, true)).rejects.toThrow("not found");
    await expect(todos.remove(other, mine.id)).rejects.toThrow("not found");
    await todos.remove(me, mine.id);
    expect((await todos.list(me.id)).open.some((r) => r.id === mine.id)).toBe(false);
  });
});
