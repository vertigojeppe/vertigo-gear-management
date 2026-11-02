import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { todoText } from "./schema";

export class TodoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TodoError";
  }
}

/**
 * Personal to-do notes. Every query is scoped to the actor's own rows, so
 * nobody (admins included) reads or changes someone else's list; no
 * permission beyond being signed in, and no activity rows (the log is shared).
 */
export const todos = {
  /** Open ones oldest first (the order they were written), then done ones newest first. */
  async list(userId: string) {
    const rows = await prisma.todo.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    return {
      open: rows.filter((r) => !r.doneAt),
      done: rows.filter((r) => r.doneAt).sort((a, b) => b.doneAt!.getTime() - a.doneAt!.getTime()),
    };
  },

  async add(actor: Actor, text: string) {
    return prisma.todo.create({ data: { userId: actor.id, text: todoText.parse(text) } });
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
