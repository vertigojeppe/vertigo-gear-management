import type { PrismaClient } from "../../src/generated/prisma/client";
import { nextAssetTag } from "../../src/lib/asset-tag";

/**
 * Demo consumables: a lamp for the lamp projectors (pieces, in a bin, a
 * spare-part link with a rule) and LED strip and alu profile in metres.
 * Re-runnable: models by (manufacturer, name), the opening stock only when
 * a metre model has no history yet, the bin only when the lamp has none.
 */
export async function seedConsumables(prisma: PrismaClient) {
  const top = (await prisma.category.findFirst({ where: { name: "Consumables", parentId: null } })) ?? (await prisma.category.create({ data: { name: "Consumables", sortOrder: 20, color: "pink" } }));
  const child = async (name: string) => (await prisma.category.findFirst({ where: { name, parentId: top.id } })) ?? (await prisma.category.create({ data: { name, parentId: top.id } }));
  const [lamps, strip, profile] = [await child("Lamps"), await child("LED strip"), await child("Alu profile")];

  const ensure = async (data: { categoryId: string; manufacturer: string; name: string; unit: "pcs" | "m"; minStock: number; notes?: string }) =>
    (await prisma.model.findFirst({ where: { manufacturer: data.manufacturer, name: data.name } })) ??
    (await prisma.model.create({ data: { ...data, trackingType: "bulk", consumable: true, notForRental: true } }));

  const lamp = await ensure({ categoryId: lamps.id, manufacturer: "Panasonic", name: "PT-EZ590 replacement lamp", unit: "pcs", minStock: 2 });
  const ledStrip = await ensure({ categoryId: strip.id, manufacturer: "", name: "LED strip 24 V 3000 K", unit: "m", minStock: 10, notes: "Cut to length for SplitLED builds." });
  const alu = await ensure({ categoryId: profile.id, manufacturer: "", name: "Alu profile 16x16", unit: "m", minStock: 12, notes: "Cut for fixture frames." });

  // The lamp: one bin of three, on the warehouse's first shelf.
  if ((await prisma.item.count({ where: { modelId: lamp.id } })) === 0) {
    const shelf = await prisma.location.findFirst({ where: { type: "warehouse" }, orderBy: { createdAt: "asc" } });
    await prisma.item.create({ data: { modelId: lamp.id, assetTag: await nextAssetTag(prisma), quantity: 3, status: "in_house", locationId: shelf?.id ?? null, homeLocationId: shelf?.id ?? null } });
  }
  // Metres: an opening delivery, then nothing (the demo can use some).
  for (const [m, metres] of [
    [ledStrip, 25],
    [alu, 36],
  ] as const) {
    if ((await prisma.stockMovement.count({ where: { modelId: m.id } })) === 0) await prisma.stockMovement.create({ data: { modelId: m.id, quantity: metres, kind: "received", note: "Opening stock" } });
  }

  // The lamp fits the lamp projector: 1 spare per 4, at least 1.
  const projector = await prisma.model.findFirst({ where: { manufacturer: "Panasonic", name: "PT-EZ590" } });
  if (projector) await prisma.partFit.upsert({ where: { partId_modelId: { partId: lamp.id, modelId: projector.id } }, create: { partId: lamp.id, modelId: projector.id, perUnits: 4, minQty: 1 }, update: {} });

  return { models: 3 };
}
