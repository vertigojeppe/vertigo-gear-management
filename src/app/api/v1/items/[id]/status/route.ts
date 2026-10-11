import { handler, json, readJson } from "@/lib/api/respond";
import { items, redactFinance, statusChangeInput } from "@/modules/inventory";

export const POST = handler<{ id: string }>("inventory.write", async (req, actor, { id }) => {
  const input = await readJson(req, statusChangeInput);
  return json({ data: redactFinance(actor, await items.changeStatus(actor, id, input)) });
});
