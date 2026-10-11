import { handler, json, readJson } from "@/lib/api/respond";
import { locationInput, locations } from "@/modules/inventory";

export const GET = handler("inventory.read", async () => json({ data: await locations.list() }));

export const POST = handler("inventory.write", async (req, actor) => {
  const input = await readJson(req, locationInput);
  return json({ data: await locations.create(actor, input) }, { status: 201 });
});
