import { handler, json, readJson } from "@/lib/api/respond";
import { categories, categoryInput } from "@/modules/inventory";

export const GET = handler("inventory.read", async () => json({ data: await categories.list() }));

export const POST = handler("inventory.write", async (req, actor) => {
  const input = await readJson(req, categoryInput);
  return json({ data: await categories.create(actor, input) }, { status: 201 });
});
