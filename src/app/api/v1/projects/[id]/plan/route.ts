import { handler, json, notFound } from "@/lib/api/respond";
import { planDetail } from "@/modules/plans";

export const GET = handler<{ id: string }>("plans.read", async (_req, _actor, { id }) => {
  const plan = await planDetail(id);
  if (!plan) notFound();
  return json({ data: plan });
});
