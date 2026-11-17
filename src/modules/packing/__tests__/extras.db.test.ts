import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { packingExtras, packingLists } from "../service";
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
});
