import { z } from "zod";
import { ApiError, handler, json, notFound, readJson } from "@/lib/api/respond";
import { validateCustomFields } from "@/lib/custom-fields";
import { itemDetail, itemInput, items, redactFinance } from "@/modules/inventory";
import { customFieldDefinitions } from "@/modules/settings";

export const GET = handler<{ id: string }>("inventory.read", async (_req, actor, { id }) => {
  const detail = await itemDetail(id);
  if (!detail) notFound();
  return json({
    data: {
      ...redactFinance(actor, detail.item),
      model: detail.model,
      categoryPath: detail.categoryPath,
      location: detail.location,
      parentItem: detail.parentItem,
      contents: detail.contents.map((c) => redactFinance(actor, c)),
      statusLogs: detail.statusLogs,
    },
  });
});

const patchBody = itemInput.partial().extend({ customFields: z.record(z.string(), z.unknown()).optional() });

export const PATCH = handler<{ id: string }>("inventory.write", async (req, actor, { id }) => {
  const existing = await items.get(id);
  if (!existing) notFound();
  const { customFields, ...patch } = await readJson(req, patchBody);
  const base = {
    modelId: existing.modelId,
    serialNumber: existing.serialNumber ?? "",
    quantity: existing.quantity,
    locationId: existing.locationId ?? "",
    isKit: existing.isKit,
    name: existing.name ?? "",
    purchaseDate: existing.purchaseDate ?? "",
    purchasePrice: existing.purchasePrice ?? "",
    supplier: existing.supplier ?? "",
    insuredValue: existing.insuredValue ?? "",
    replacementValue: existing.replacementValue ?? "",
    conditionNotes: existing.conditionNotes ?? "",
    notes: existing.notes ?? "",
  };
  const input = itemInput.parse({ ...base, ...patch });
  const defs = await customFieldDefinitions.forEntity("item");
  const cf = validateCustomFields(defs, { ...existing.customFields, ...(customFields ?? {}) });
  if (!cf.ok) throw new ApiError(422, "Custom field validation failed", cf.errors);
  return json({ data: redactFinance(actor, await items.update(actor, id, input, cf.values)) });
});

export const DELETE = handler<{ id: string }>("users.manage", async (_req, actor, { id }) => {
  await items.remove(actor, id);
  return json({ ok: true });
});
