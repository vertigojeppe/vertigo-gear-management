import { z } from "zod";
import { ApiError, handler, json, queryObject, readJson } from "@/lib/api/respond";
import { validateCustomFields } from "@/lib/custom-fields";
import { itemBatchInput, itemFilters, items, listItems, redactFinance } from "@/modules/inventory";
import { customFieldDefinitions } from "@/modules/settings";

export const GET = handler("inventory.read", async (req, actor) => {
  const q = queryObject(req);
  const filters = itemFilters.parse(q);
  const cfEntry = Object.entries(q).find(([k, v]) => k.startsWith("cf.") && v);
  const result = await listItems({ ...filters, customField: cfEntry ? { key: cfEntry[0].slice(3), value: cfEntry[1] } : undefined });
  return json({ ...result, rows: result.rows.map((r) => redactFinance(actor, r)) });
});

const createBody = itemBatchInput.extend({ customFields: z.record(z.string(), z.unknown()).optional() });

export const POST = handler("inventory.write", async (req, actor) => {
  const { customFields, count, serialNumbers, ...input } = await readJson(req, createBody);
  const defs = await customFieldDefinitions.forEntity("item");
  const cf = validateCustomFields(defs, customFields ?? {});
  if (!cf.ok) throw new ApiError(422, "Custom field validation failed", cf.errors);
  const created = await items.create(actor, input, {
    count,
    serialNumbers: serialNumbers ? serialNumbers.split(/\r?\n/).map((s) => s.trim()) : undefined,
    customFields: cf.values,
  });
  return json({ data: created.map((i) => redactFinance(actor, i)) }, { status: 201 });
});
