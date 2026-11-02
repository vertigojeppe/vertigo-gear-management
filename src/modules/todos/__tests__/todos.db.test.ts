import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { todos } from "../service";

/** Personal to-dos against the dev/CI database: order, editing, categories, moving, done/reopen, and that nobody reaches another person's list. */
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

const open = async (a: Actor) => (await todos.list(a.id)).groups.map((g) => [g.category, g.rows.map((r) => r.text)]);

describe("todos", () => {
  it("keeps open ones in written order and done ones newest first", async () => {
    const a = await todos.add(me, { text: "  Order gaffa  " });
    await todos.add(me, { text: "Call the venue" });
    expect(a.text).toBe("Order gaffa");
    await todos.setDone(me, a.id, true);
    expect(await open(me)).toEqual([[null, ["Call the venue"]]]);
    expect((await todos.list(me.id)).done.map((r) => r.id)).toEqual([a.id]);
    await todos.setDone(me, a.id, false);
    expect(await open(me)).toEqual([[null, ["Order gaffa", "Call the venue"]]]);
    await expect(todos.add(me, { text: "   " })).rejects.toThrow();
  });

  it("edits, groups by category and moves within a group", async () => {
    const [x] = (await todos.list(me.id)).groups[0].rows;
    await todos.update(me, x.id, { text: "Order gaffa, black", category: " Indkøb " });
    await todos.add(me, { text: "Cable ties", category: "Indkøb" });
    expect(await open(me)).toEqual([
      [null, ["Call the venue"]],
      ["Indkøb", ["Order gaffa, black", "Cable ties"]],
    ]);
    expect((await todos.list(me.id)).categories).toEqual(["Indkøb"]);
    const ties = (await todos.list(me.id)).groups[1].rows[1];
    await todos.move(me, ties.id, "up");
    expect((await open(me))[1]).toEqual(["Indkøb", ["Cable ties", "Order gaffa, black"]]);
    await todos.move(me, ties.id, "up"); // already first: no change
    expect((await open(me))[1]).toEqual(["Indkøb", ["Cable ties", "Order gaffa, black"]]);
  });

  it("never shows or changes someone else's list, admins included", async () => {
    const mine = await todos.add(me, { text: "Private note" });
    expect((await todos.list(other.id)).groups).toEqual([]);
    await expect(todos.setDone(other, mine.id, true)).rejects.toThrow("not found");
    await expect(todos.update(other, mine.id, { text: "Hacked" })).rejects.toThrow("not found");
    await expect(todos.move(other, mine.id, "up")).rejects.toThrow("not found");
    await expect(todos.remove(other, mine.id)).rejects.toThrow("not found");
    await todos.remove(me, mine.id);
    expect((await open(me)).flatMap(([, texts]) => texts)).not.toContain("Private note");
  });
});
