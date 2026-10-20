import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { packingChecks, packingLines, packingLists, undoCheckIn } from "../service";
import { listDetail } from "../queries";

/**
 * A whole bulk line coming back OK in one go: the travel bin merges into
 * its source bin and disappears, and the check-in must still be recorded
 * (and be undoable).
 */
const stamp = Date.now();
const marker = `bulkret-${stamp}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
let categoryId: string;
let homeId: string;
let cableId: string;
let binId: string;
let projectId: string;
let listId: string;

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  categoryId = (await prisma.category.create({ data: { name: `Cat ${marker}` } })).id;
  homeId = (await prisma.location.create({ data: { name: `Shelf ${marker}`, type: "warehouse" } })).id;
  cableId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Cable ${marker}`, trackingType: "bulk" } })).id;
  binId = (await prisma.item.create({ data: { modelId: cableId, assetTag: `BR-${stamp}1`, quantity: 10, status: "in_house", locationId: homeId, homeLocationId: homeId } })).id;
  projectId = (await prisma.project.create({ data: { name: `Bulk show ${marker}`, status: "confirmed" } })).id;
  listId = (await packingLists.create(admin, projectId, { name: `List ${marker}`, groupBy: "category", notes: undefined, source: "empty", sourceId: undefined })).id;
});

afterAll(async () => {
  await prisma.packingList.deleteMany({ where: { projectId } });
  await prisma.location.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } });
  await prisma.item.deleteMany({ where: { modelId: cableId } });
  await prisma.model.delete({ where: { id: cableId } });
  await prisma.category.delete({ where: { id: categoryId } });
  await prisma.location.delete({ where: { id: homeId } });
  await prisma.activityLog.deleteMany({ where: { summary: { contains: marker } } });
  await prisma.$disconnect();
});

describe("bulk return in one go", () => {
  it("merges the whole travel bin back, records the check-in, and can be undone", async () => {
    await packingLines.add(admin, listId, { modelId: cableId, quantity: 4, note: undefined, caseItemId: undefined });
    const line = (await listDetail(listId))!.lines[0];
    await packingChecks.tick(admin, { lineId: line.id, itemId: undefined, quantity: 4 });
    await packingLists.checkOut(admin, listId);
    expect((await prisma.item.findUniqueOrThrow({ where: { id: binId } })).quantity).toBe(6);

    const out = (await listDetail(listId))!.lines[0].checks.find((c) => c.phase === "out")!;
    const inCheck = await packingChecks.checkIn(admin, { outCheckId: out.id, outcome: "ok", quantity: 4, note: undefined });
    expect((await prisma.item.findUniqueOrThrow({ where: { id: binId } })).quantity).toBe(10);
    expect(await prisma.item.count({ where: { modelId: cableId } })).toBe(1);
    expect((await listDetail(listId))!.progress.toReturn).toBe(0);

    await undoCheckIn(admin, inCheck.id);
    expect((await prisma.item.findUniqueOrThrow({ where: { id: binId } })).quantity).toBe(6);
    const travel = await prisma.item.findFirstOrThrow({ where: { modelId: cableId, id: { not: binId } } });
    expect(travel).toMatchObject({ quantity: 4, status: "on_project" });
  });
});
