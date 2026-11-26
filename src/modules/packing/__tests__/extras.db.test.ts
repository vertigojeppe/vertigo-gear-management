import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { packingExtras, packingLines, packingLists } from "../service";
import { listDetail } from "../queries";

/**
 * Lines for things not in the inventory: added and removed while drafting,
 * ticked while packing, left alone by check-out, and linked to a model once
 * it has been added to the inventory.
 */
const marker = `extra-${Date.now()}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
const viewer: Actor = { id: "", email: "", name: "Test Viewer", role: "viewer" };
let categoryId: string;
let modelId: string;
let projectId: string;
let listId: string;

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  viewer.id = admin.id;
  categoryId = (await prisma.category.create({ data: { name: `Cat ${marker}` } })).id;
  modelId = (await prisma.model.create({ data: { categoryId, manufacturer: "", name: `Wire ${marker}`, trackingType: "bulk" } })).id;
  projectId = (await prisma.project.create({ data: { name: `Show ${marker}`, status: "confirmed" } })).id;
  listId = (await packingLists.create(admin, projectId, { name: `List ${marker}`, groupBy: "category", notes: undefined, source: "empty", sourceId: undefined })).id;
});

afterAll(async () => {
  await prisma.packingList.deleteMany({ where: { projectId } });
  await prisma.location.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } });
  await prisma.item.deleteMany({ where: { modelId } });
  await prisma.model.delete({ where: { id: modelId } });
  await prisma.category.delete({ where: { id: categoryId } });
  await prisma.activityLog.deleteMany({ where: { summary: { contains: marker } } });
  await prisma.$disconnect();
});

describe("packing list lines not in the inventory", () => {
  it("adds and ticks while drafting, freezes once out, and links a model added later", async () => {
    await expect(packingExtras.add(viewer, listId, { name: `Black wire ${marker}`, quantity: 2, note: "about 30 m" })).rejects.toThrow();
    const wire = await packingExtras.add(admin, listId, { name: `Black wire ${marker}`, quantity: 2, note: "about 30 m" });
    const tape = await packingExtras.add(admin, listId, { name: `Gaffer ${marker}`, quantity: 1, note: undefined });

    await packingExtras.setPacked(admin, wire.id, true);
    let detail = (await listDetail(listId))!;
    expect(detail.extras.map((x) => [x.name, x.quantity, x.note, x.packed])).toEqual([
      [`Black wire ${marker}`, 2, "about 30 m", true],
      [`Gaffer ${marker}`, 1, null, false],
    ]);
    expect(detail.progress.units).toBe(0);

    await packingExtras.remove(admin, tape.id);
    // Once the list is out (check-out needs a real unit packed, so set it here), they are frozen like the other lines.
    await prisma.packingList.update({ where: { id: listId }, data: { status: "checked_out" } });
    await expect(packingExtras.setPacked(admin, wire.id, false)).rejects.toThrow(/being packed/);
    await expect(packingExtras.add(admin, listId, { name: "Late", quantity: 1, note: undefined })).rejects.toThrow(/draft/);

    // Added to the inventory later: the line points at the model.
    await packingExtras.linkModel(admin, wire.id, modelId);
    detail = (await listDetail(listId))!;
    expect(detail.extras).toEqual([expect.objectContaining({ id: wire.id, modelId, modelLabel: `Wire ${marker}`, packed: true })]);
  });

  it("moves into a draft list's gear once the model has stock, as much as fits", async () => {
    const draft = (await packingLists.create(admin, projectId, { name: `Draft ${marker}`, groupBy: "section", notes: undefined, source: "empty", sourceId: undefined })).id;
    const x = await packingExtras.add(admin, draft, { name: `Wire ${marker}`, quantity: 3, note: "cut to length" });
    await packingExtras.linkModel(admin, x.id, modelId);
    await packingExtras.moveToGear(admin, modelId); // no stock yet: stays
    expect((await listDetail(draft))!.extras).toHaveLength(1);

    await prisma.item.create({ data: { modelId, assetTag: `T${Date.now()}`, quantity: 2, status: "in_house" } });
    await packingExtras.moveToGear(admin, modelId);
    let detail = (await listDetail(draft))!;
    expect(detail.lines.map((l) => [l.quantity, l.note])).toEqual([[2, "cut to length"]]);
    expect(detail.extras.map((e) => e.quantity)).toEqual([1]);
    // The checked-out list's extra from the first test is left alone.
    expect((await listDetail(listId))!.extras).toHaveLength(1);

    // Several lines into one section at once, and out again.
    expect(await packingLines.setSection(admin, draft, detail.lines.map((l) => l.id), "Truck 2")).toBe(1);
    detail = (await listDetail(draft))!;
    expect(detail.lines[0].section).toBe("Truck 2");
    await packingLines.setSection(admin, draft, [detail.lines[0].id], null);
    expect((await listDetail(draft))!.lines[0].section).toBeNull();
    await expect(packingLines.setSection(admin, listId, [detail.lines[0].id], "X")).rejects.toThrow(/draft/);
  });
});
