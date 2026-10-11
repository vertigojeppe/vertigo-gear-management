import { z } from "zod";
import { ApiError, handler, json, queryObject, readJson } from "@/lib/api/respond";
import { validateCustomFields } from "@/lib/custom-fields";
import { listModels, modelFilters, modelInput, models } from "@/modules/inventory";
import { customFieldDefinitions } from "@/modules/settings";

export const GET = handler("inventory.read", async (req) => {
  const filters = modelFilters.parse(queryObject(req));
  return json(await listModels(filters));
});

const createBody = modelInput.extend({ customFields: z.record(z.string(), z.unknown()).optional() });

export const POST = handler("inventory.write", async (req, actor) => {
  const { customFields, ...input } = await readJson(req, createBody);
  const defs = await customFieldDefinitions.forEntity("model");
  const cf = validateCustomFields(defs, customFields ?? {});
  if (!cf.ok) throw new ApiError(422, "Custom field validation failed", cf.errors);
  return json({ data: await models.create(actor, input, cf.values) }, { status: 201 });
});
