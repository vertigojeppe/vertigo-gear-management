import { ApiError, handler, json, queryObject } from "@/lib/api/respond";
import { addDays, today } from "@/lib/dates";
import { entriesBetween, entryFilters } from "@/modules/agenda";

export const GET = handler("projects.read", async (req, actor) => {
  const q = entryFilters.parse(queryObject(req));
  const from = q.from ?? today();
  const to = q.to ?? addDays(from, 30);
  if (to < from || to > addDays(from, 366)) throw new ApiError(400, "to must be on or after from, and at most a year later");
  return json({ data: await entriesBetween(from, to, q.mine ? { userId: actor.id } : {}) });
});
