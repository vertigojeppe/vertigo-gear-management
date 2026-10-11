import { handler, json, notFound } from "@/lib/api/respond";
import { items, redactFinance } from "@/modules/inventory";

export const GET = handler<{ tag: string }>("inventory.read", async (_req, actor, { tag }) => {
  const item = await items.findByAssetTag(decodeURIComponent(tag));
  if (!item) notFound();
  return json({ data: redactFinance(actor, item) });
});
