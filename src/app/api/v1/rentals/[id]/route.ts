import { handler, json, notFound } from "@/lib/api/respond";
import { rentalDetail } from "@/modules/rentals";

export const GET = handler<{ id: string }>("rentals.read", async (_req, _actor, { id }) => {
  const detail = await rentalDetail(id);
  if (!detail) notFound();
  return json({ data: { ...detail.rental, client: detail.client, lines: detail.lines, totals: detail.totals } });
});
