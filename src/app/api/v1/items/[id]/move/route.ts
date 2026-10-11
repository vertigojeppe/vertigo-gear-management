import { handler, json, readJson } from "@/lib/api/respond";
import { items, moveInput, redactFinance } from "@/modules/inventory";

export const POST = handler<{ id: string }>("inventory.write", async (req, actor, { id }) => {
  const input = await readJson(req, moveInput);
  return json({ data: redactFinance(actor, await items.move(actor, id, input.locationId ?? null)) });
});
