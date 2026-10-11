import { handler, json, queryObject, readJson } from "@/lib/api/respond";
import { listRentals, rentalFilters, rentalInput, rentals } from "@/modules/rentals";

export const GET = handler("rentals.read", async (req) => json(await listRentals(rentalFilters.parse(queryObject(req)))));

export const POST = handler("rentals.write", async (req, actor) => {
  const input = await readJson(req, rentalInput);
  return json({ data: await rentals.create(actor, input) }, { status: 201 });
});
