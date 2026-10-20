import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { consumables, consumableDetail, lowStock, partFits, sparePartsFor, stockByModel } from "../consumables";
import { consumableUseInput } from "../schema";

/**
 * Integration test against the dev/CI database: a metre consumable is
 * received, used and counted through the ledger; a piece consumable is used
 * from its bins into a unit; parts fit models; running low shows up.
 */
const marker = `cons-${Date.now().toString(36)}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
const viewer: Actor = { id: "", email: "", name: "Test Viewer", role: "viewer" };

let categoryId: string;
let stripId: string;
let lampId: string;
let projectorId: string;
let unitId: string;
let unitTag: string;
let projectId: string;

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  categoryId = (await prisma.category.create({ data: { name: `Cat ${marker}` } })).id;
  stripId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Strip ${marker}`, trackingType: "bulk", consumable: true, unit: "m", minStock: 10 } })).id;
  lampId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Lamp ${marker}`, trackingType: "bulk", consumable: true, unit: "pcs", minStock: 2 } })).id;
  projectorId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Projector ${marker}`, trackingType: "serialized" } })).id;
  unitTag = `CT-${Date.now().toString(36).toUpperCase()}`;
  unitId = (await prisma.item.create({ data: { modelId: projectorId, assetTag: unitTag, status: "in_house" } })).id;
  await prisma.item.create({ data: { modelId: lampId, assetTag: `${unitTag}-B1`, quantity: 2, status: "in_house" } });
  await prisma.item.create({ data: { modelId: lampId, assetTag: `${unitTag}-B2`, quantity: 1, status: "in_house" } });
  projectId = (await prisma.project.create({ data: { name: `Show ${marker}`, status: "confirmed" } })).id;
});

afterAll(async () => {
  const modelIds = [stripId, lampId, projectorId];
  const itemIds = (await prisma.item.findMany({ where: { modelId: { in: modelIds } }, select: { id: true } })).map((i) => i.id);
  await prisma.stockMovement.deleteMany({ where: { modelId: { in: modelIds } } });
  await prisma.item.deleteMany({ where: { modelId: { in: modelIds } } });
  await prisma.model.deleteMany({ where: { id: { in: modelIds } } });
  await prisma.category.delete({ where: { id: categoryId } });
  await prisma.project.delete({ where: { id: projectId } });
  await prisma.activityLog.deleteMany({ where: { entityId: { in: [...modelIds, ...itemIds, projectId] } } });
  await prisma.$disconnect();
});

const use = (over: Record<string, unknown>) => consumableUseInput.parse({ modelId: stripId, quantity: "1", ...over });

describe("consumables", () => {
  it("metres: receive, use, count, and refuse more than is there", async () => {
    await expect(consumables.receive(viewer, { modelId: stripId, quantity: 25 })).rejects.toThrow();
    await consumables.receive(admin, { modelId: stripId, quantity: 25, note: "reel" });
    await consumables.use(admin, use({ quantity: "3.5", projectId }));
    await consumables.use(admin, use({ quantity: "2.25" }));
    expect((await stockByModel([{ id: stripId, unit: "m" }])).get(stripId)).toBe(19.25);
    await expect(consumables.use(admin, use({ quantity: "20" }))).rejects.toThrow(/Only 19,25 m in stock/);

    await consumables.count(admin, { modelId: stripId, quantity: 18 });
    expect(await consumables.count(admin, { modelId: stripId, quantity: 18 })).toBeNull();
    const d = await consumableDetail(stripId);
    expect(d).toMatchObject({ unit: "m", stock: 18, minStock: 10, low: false });
    expect(d!.movements.map((m) => [m.kind, m.quantity])).toEqual([
      ["count", -1.25],
      ["used", -2.25],
      ["used", -3.5],
      ["received", 25],
    ]);
    expect(d!.movements[2].projectName).toBe(`Show ${marker}`);
  });

  it("pieces: use takes from the fullest bin first and logs the unit", async () => {
    await expect(consumables.receive(admin, { modelId: lampId, quantity: 1 })).rejects.toThrow(/added as items/);
    await consumables.use(admin, use({ modelId: lampId, quantity: "2", itemTag: unitTag.toLowerCase(), projectId }));
    const bins = await prisma.item.findMany({ where: { modelId: lampId }, orderBy: { assetTag: "asc" }, select: { assetTag: true, quantity: true } });
    expect(bins.map((b) => b.quantity)).toEqual([0, 1]);
    await expect(consumables.use(admin, use({ modelId: lampId, quantity: "2" }))).rejects.toThrow(/Only 1 in house/);
    await expect(consumables.use(admin, use({ modelId: lampId, quantity: "1", itemTag: "NOPE-0000" }))).rejects.toThrow(/No unit/);

    const movement = await prisma.stockMovement.findFirstOrThrow({ where: { modelId: lampId } });
    expect(movement).toMatchObject({ itemId: unitId, projectId, kind: "used" });
    expect(movement.quantity.toNumber()).toBe(-2);
    expect(await prisma.activityLog.count({ where: { entityType: "item", entityId: unitId, action: "part_used" } })).toBe(1);
  });

  it("parts fit models and running low is listed", async () => {
    await expect(partFits.add(admin, projectorId, { modelId: lampId, perUnits: 4, minQty: 1 })).rejects.toThrow(/Only consumables/);
    await partFits.add(admin, lampId, { modelId: projectorId, perUnits: 4, minQty: 1 });
    await partFits.add(admin, lampId, { modelId: projectorId, perUnits: 2, minQty: 1 });
    const spares = await sparePartsFor(projectorId);
    expect(spares).toHaveLength(1);
    expect(spares[0]).toMatchObject({ partId: lampId, perUnits: 2, stock: 1, low: true });

    const low = (await lowStock()).filter((r) => r.label.includes(marker));
    expect(low.map((r) => r.modelId)).toEqual([lampId]);
    expect(low[0]).toMatchObject({ stock: 1, minStock: 2, onWishList: false });

    await partFits.remove(admin, spares[0].fitId);
    expect(await sparePartsFor(projectorId)).toHaveLength(0);
  });
});
