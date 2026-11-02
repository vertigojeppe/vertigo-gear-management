import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { groupTodos, moved } from "./logic";
import { todoInput, type TodoInput } from "./schema";

export class TodoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TodoError";
  }
}

/** Last place in the owner's list, so a new or re-categorised line goes to the bottom of its group. */
async function nextPosition(userId: string) {
  const last = await prisma.todo.aggregate({ where: { userId }, _max: { position: true } });
  return (last._max.position ?? -1) + 1;
}

/**
 * Personal to-do notes. Every query is scoped to the actor's own rows, so
 * nobody (admins included) reads or changes someone else's list; no
 * permission beyond being signed in, and no activity rows (the log is shared).
 */
export const todos = {
  /** Open ones grouped by category in their own order, done ones newest first, and the categories in use (for suggestions). */
  async list(userId: string) {
    const rows = await prisma.todo.findMany({ where: { userId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
    return {
      groups: groupTodos(rows.filter((r) => !r.doneAt)),
      done: rows.filter((r) => r.doneAt).sort((a, b) => b.doneAt!.getTime() - a.doneAt!.getTime()),
      categories: [...new Set(rows.flatMap((r) => (r.category ? [r.category] : [])))].sort((a, b) => a.localeCompare(b, "da")),
    };
  },

  async add(actor: Actor, input: TodoInput) {
    const data = todoInput.parse(input);
    return prisma.todo.create({ data: { ...data, userId: actor.id, position: await nextPosition(actor.id) } });
  },

  async update(actor: Actor, id: string, input: TodoInput) {
    const data = todoInput.parse(input);
    const row = await prisma.todo.findFirst({ where: { id, userId: actor.id } });
    if (!row) throw new TodoError("To-do not found.");
    const position = row.category === data.category ? row.position : await nextPosition(actor.id);
    await prisma.todo.update({ where: { id }, data: { ...data, position } });
  },

  /** One step up or down among the open lines of its category. */
  async move(actor: Actor, id: string, dir: "up" | "down") {
    const row = await prisma.todo.findFirst({ where: { id, userId: actor.id } });
    if (!row) throw new TodoError("To-do not found.");
    const group = await prisma.todo.findMany({ where: { userId: actor.id, category: row.category, doneAt: null }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, position: true } });
    const ids = moved(
      group.map((g) => g.id),
      id,
      dir,
    );
    // Renumber the group onto the positions it already holds, so other groups keep theirs.
    const slots = group.map((g) => g.position).sort((a, b) => a - b);
    const fixed = slots.map((p, i) => (i > 0 && p <= slots[i - 1] ? slots[i - 1] + 1 : p));
    await prisma.$transaction(ids.map((gid, i) => prisma.todo.update({ where: { id: gid }, data: { position: fixed[i] } })));
  },

  async setDone(actor: Actor, id: string, done: boolean) {
    const { count } = await prisma.todo.updateMany({ where: { id, userId: actor.id }, data: { doneAt: done ? new Date() : null } });
    if (!count) throw new TodoError("To-do not found.");
  },

  async remove(actor: Actor, id: string) {
    const { count } = await prisma.todo.deleteMany({ where: { id, userId: actor.id } });
    if (!count) throw new TodoError("To-do not found.");
  },
};
