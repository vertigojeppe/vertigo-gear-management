import { z } from "zod";
import { ApiError, handler, json, notFound, readJson } from "@/lib/api/respond";
import { validateCustomFields } from "@/lib/custom-fields";
import { linksToText, modelDetail, modelInput, models } from "@/modules/inventory";
import { customFieldDefinitions } from "@/modules/settings";

export const GET = handler<{ id: string }>("inventory.read", async (_req, _actor, { id }) => {
  const detail = await modelDetail(id);
  if (!detail) notFound();
  return json({ data: { ...detail.model, categoryPath: detail.categoryPath, owned: detail.owned, byStatus: detail.byStatus, items: detail.items } });
});

const patchBody = modelInput.partial().extend({ customFields: z.record(z.string(), z.unknown()).optional() });

export const PATCH = handler<{ id: string }>("inventory.write", async (req, actor, { id }) => {
  const existing = await models.get(id);
  if (!existing) notFound();
  const { customFields, ...patch } = await readJson(req, patchBody);
  const base = {
    categoryId: existing.categoryId,
    manufacturer: existing.manufacturer,
    name: existing.name,
    trackingType: existing.trackingType,
    description: existing.description ?? "",
    weightKg: existing.weightKg ?? "",
    widthCm: existing.widthCm ?? "",
    heightCm: existing.heightCm ?? "",
    depthCm: existing.depthCm ?? "",
    powerDrawW: existing.powerDrawW ?? "",
    notes: existing.notes ?? "",
    linksText: linksToText(existing.links),
  };
  const input = modelInput.parse({ ...base, ...patch });
  const defs = await customFieldDefinitions.forEntity("model");
  const cf = validateCustomFields(defs, { ...existing.customFields, ...(customFields ?? {}) });
  if (!cf.ok) throw new ApiError(422, "Custom field validation failed", cf.errors);
  return json({ data: await models.update(actor, id, input, cf.values) });
});

export const DELETE = handler<{ id: string }>("inventory.write", async (_req, actor, { id }) => {
  await models.remove(actor, id);
  return json({ ok: true });
});
