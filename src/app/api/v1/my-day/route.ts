import { handler, json } from "@/lib/api/respond";
import { addDays, today } from "@/lib/dates";
import { entriesBetween } from "@/modules/agenda";
import { myDay } from "@/modules/plans";
import { todos } from "@/modules/todos";

/** The dashboard's "My day" for the caller: schedule, tasks, coming projects, today's and tomorrow's entries, open to-dos. */
export const GET = handler("projects.read", async (_req, actor) => {
  const [day, entries, list] = await Promise.all([myDay(actor.id), entriesBetween(today(), addDays(today(), 1), { userId: actor.id }), todos.list(actor.id)]);
  return json({ data: { ...day, entries, todos: list.groups } });
});
