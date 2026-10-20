import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { PackingError, packingChecks, packingLines, packingLists, undoCheckIn } from "../service";
import { listDetail, spareSuggestions } from "../queries";

/**
 * Integration test: a list with six projectors suggests two spare lamps
 * (1 per 4, at least 1), capped by what is in house; "not this time" hides
 * it; a lamp packed and checked in as "used" leaves the stock with a ledger
 * row, and undoing that check-in puts it back.
 */
const stamp = Date.now();
const marker = `spares-${stamp}`;
const tag = (n: number) => `SP-${stamp}${n}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
let categoryId: string;
let homeId: string;
let projectorId: string;
let lampId: string;
let filterId: string;
let projectId: string;
let listId: string;
let lampBinId: string;

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  categoryId = (await prisma.category.create({ data: { name: `Cat ${marker}` } })).id;
  homeId = (await prisma.location.create({ data: { name: `Shelf ${marker}`, type: "warehouse" } })).id;
  projectorId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Projector ${marker}`, trackingType: "serialized" } })).id;
  lampId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Lamp ${marker}`, trackingType: "bulk", consumable: true, unit: "pcs" } })).id;
  filterId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Filter ${marker}`, trackingType: "bulk", consumable: true, unit: "pcs" } })).id;
  for (let i = 0; i < 6; i++) await prisma.item.create({ data: { modelId: projectorId, assetTag: tag(i), status: "in_house", locationId: homeId, homeLocationId: homeId } });
  lampBinId = (await prisma.item.create({ data: { modelId: lampId, assetTag: tag(7), quantity: 1, status: "in_house", locationId: homeId, homeLocationId: homeId } })).id;
  await prisma.partFit.create({ data: { partId: lampId, modelId: projectorId, perUnits: 4, minQty: 1 } });
  await prisma.partFit.create({ data: { partId: filterId, modelId: projectorId, perUnits: 2, minQty: 1 } });
  projectId = (await prisma.project.create({ data: { name: `Spares show ${marker}`, status: "confirmed" } })).id;
  listId = (await packingLists.create(admin, projectId, { name: `List ${marker}`, groupBy: "category", notes: undefined, source: "empty", sourceId: undefined })).id;
});

afterAll(async () => {
  const modelIds = [projectorId, lampId, filterId];
  await prisma.stockMovement.deleteMany({ where: { modelId: { in: modelIds } } });
  await prisma.packingList.deleteMany({ where: { projectId } });
  await prisma.location.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } });
  await prisma.item.deleteMany({ where: { modelId: { in: modelIds } } });
  await prisma.model.deleteMany({ where: { id: { in: modelIds } } });
  await prisma.category.delete({ where: { id: categoryId } });
  await prisma.location.delete({ where: { id: homeId } });
  await prisma.activityLog.deleteMany({ where: { summary: { contains: marker } } });
  await prisma.$disconnect();
});

describe("spare suggestions and used check-in", () => {
  it("suggests spares by the rules, capped by stock, and can be waved off", async () => {
    await packingLines.add(admin, listId, { modelId: projectorId, quantity: 6, note: undefined, caseItemId: undefined });
    const rows = await spareSuggestions(listId);
    const lamp = rows.find((r) => r.partId === lampId)!;
    const filter = rows.find((r) => r.partId === filterId)!;
    expect(lamp).toMatchObject({ wanted: 2, onList: 0, add: 1, short: 1, inHouse: 1, label: `Test Lamp ${marker}`, forModels: [`Test Projector ${marker}`] });
    expect(filter).toMatchObject({ wanted: 3, add: 0, short: 3, inHouse: 0 });

    await packingLists.dismissSpare(admin, listId, filterId);
    await packingLists.dismissSpare(admin, listId, filterId);
    expect((await spareSuggestions(listId)).map((r) => r.partId)).toEqual([lampId]);

    // Adding the suggested lamp makes the suggestion shrink to the shortfall only.
    await packingLines.add(admin, listId, { modelId: lampId, quantity: 1, note: undefined, caseItemId: undefined });
    expect((await spareSuggestions(listId)).find((r) => r.partId === lampId)).toMatchObject({ onList: 1, add: 0, short: 1 });
  });

  it("a spare checked in as used leaves the stock, and undo brings it back", async () => {
    let detail = (await listDetail(listId))!;
    const lampLine = detail.lines.find((l) => l.modelId === lampId)!;
    expect(lampLine.consumable).toBe(true);
    await packingChecks.tick(admin, { lineId: lampLine.id, itemId: undefined, quantity: 1 });
    const projLine = detail.lines.find((l) => l.modelId === projectorId)!;
    await packingChecks.tick(admin, { lineId: projLine.id, itemId: (await prisma.item.findFirstOrThrow({ where: { assetTag: tag(0) } })).id, quantity: undefined });
    await packingLists.checkOut(admin, listId);

    detail = (await listDetail(listId))!;
    const out = detail.lines.find((l) => l.modelId === lampId)!.checks.find((c) => c.phase === "out")!;
    const projOut = detail.lines.find((l) => l.modelId === projectorId)!.checks.find((c) => c.phase === "out")!;
    await expect(packingChecks.checkIn(admin, { outCheckId: projOut.id, outcome: "used", quantity: undefined, note: undefined })).rejects.toBeInstanceOf(PackingError);

    const inCheck = await packingChecks.checkIn(admin, { outCheckId: out.id, outcome: "used", quantity: 1, note: "Lamp blew in the show" });
    const movement = await prisma.stockMovement.findUniqueOrThrow({ where: { packingCheckId: inCheck.id } });
    expect(movement).toMatchObject({ modelId: lampId, projectId, kind: "used" });
    expect(movement.quantity.toNumber()).toBe(-1);
    // The travel bin is gone and the source bin was never refilled: the lamp left the stock.
    expect(await prisma.item.count({ where: { modelId: lampId, id: { not: lampBinId } } })).toBe(0);
    expect((await prisma.item.findUniqueOrThrow({ where: { id: lampBinId } })).quantity).toBe(0);
    expect((await listDetail(listId))!.progress.used).toBe(1);

    await undoCheckIn(admin, inCheck.id);
    expect(await prisma.stockMovement.count({ where: { modelId: lampId } })).toBe(0);
    const travel = await prisma.item.findFirstOrThrow({ where: { modelId: lampId, id: { not: lampBinId } } });
    expect(travel).toMatchObject({ quantity: 1, status: "on_project" });
    expect((await listDetail(listId))!.progress.used).toBe(0);
  });
});
