import { handler, json, queryObject } from "@/lib/api/respond";
import { availabilityQuery, modelAvailabilityView } from "@/modules/projects";

/** Availability of a model in a date range (defaults to the next 30 days). */
export const GET = handler<{ id: string }>("inventory.read", async (req, _actor, { id }) => {
  const q = availabilityQuery.parse(queryObject(req));
  return json({ data: await modelAvailabilityView(id, q.from, q.to) });
});
