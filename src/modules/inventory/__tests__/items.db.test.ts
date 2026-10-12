import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { InventoryError, items } from "../service";

/**
 * Integration tests against the dev/CI database. They create their own
 * category/model/items with a unique marker and delete them afterwards.
 */
const marker = `test-${Date.now()}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
const viewer: Actor = { id: "", email: "", name: "Test Viewer", role: "viewer" };

let categoryId: string;
let modelId: string;
let caseModelId: string;
let bulkModelId: string;

beforeAll(async () => {
  const user = await prisma.user.findFirst({ where: { role: "admin" } });
  admin.id = user?.id ?? "";
  const cat = await prisma.category.create({ data: { name: `Cat ${marker}` } });
  categoryId = cat.id;
  modelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Projector ${marker}`, trackingType: "serialized" } })).id;
  caseModelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Case ${marker}`, trackingType: "serialized" } })).id;
  bulkModelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Cable ${marker}`, trackingType: "bulk" } })).id;
});

afterAll(async () => {
  const ids = (await prisma.model.findMany({ where: { categoryId }, select: { id: true } })).map((m) => m.id);
  const itemIds = (await prisma.item.findMany({ where: { modelId: { in: ids } }, select: { id: true } })).map((i) => i.id);
  await prisma.item.updateMany({ where: { modelId: { in: ids } }, data: { parentItemId: null } });
  await prisma.item.deleteMany({ where: { modelId: { in: ids } } });
  await prisma.model.deleteMany({ where: { id: { in: ids } } });
  await prisma.category.delete({ where: { id: categoryId } });
  // Keep the demo activity feed clean.
  await prisma.activityLog.deleteMany({ where: { entityId: { in: [...itemIds, ...ids, categoryId] } } });
  await prisma.$disconnect();
});

const base = {
  modelId: "",
  serialNumber: undefined,
  quantity: 1,
  locationId: undefined,
  isKit: false,
  name: undefined,
  purchaseDate: undefined,
  purchasePrice: undefined,
  supplier: undefined,
  insuredValue: undefined,
  replacementValue: undefined,
  conditionNotes: undefined,
  notes: undefined,
  notForRental: false,
};

describe("items service", () => {
  it("creates several serialized units with unique asset tags and serials", async () => {
    const created = await items.create(admin, { ...base, modelId }, { count: 3, serialNumbers: ["A1", "A2", "A3"] });
    expect(created).toHaveLength(3);
    expect(new Set(created.map((i) => i.assetTag)).size).toBe(3);
    expect(created.map((i) => i.serialNumber)).toEqual(["A1", "A2", "A3"]);
    expect(created.every((i) => i.status === "in_house")).toBe(true);
  });

  it("creates exactly one bin for bulk models", async () => {
    const created = await items.create(admin, { ...base, modelId: bulkModelId, quantity: 25 }, { count: 5 });
    expect(created).toHaveLength(1);
    expect(created[0].quantity).toBe(25);
  });

  it("refuses status changes without a required reason", async () => {
    const [item] = await items.create(admin, { ...base, modelId });
    await expect(items.changeStatus(admin, item.id, { status: "in_repair", reason: undefined, locationId: undefined })).rejects.toBeInstanceOf(InventoryError);
    const after = await items.get(item.id);
    expect(after?.status).toBe("in_house");
  });

  it("logs status changes with reason and user", async () => {
    const [item] = await items.create(admin, { ...base, modelId });
    await items.changeStatus(admin, item.id, { status: "missing", reason: "Not in the truck after load-out", locationId: undefined });
    const logs = await prisma.statusLog.findMany({ where: { itemId: item.id }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.toStatus)).toEqual(["in_house", "missing"]);
    expect(logs[1].reason).toContain("truck");
    expect(logs[1].userId).toBe(admin.id || null);
  });

  it("cascades status and location to kit contents", async () => {
    const [kit] = await items.create(admin, { ...base, modelId: caseModelId, isKit: true, name: `Kit ${marker}` });
    const [head] = await items.create(admin, { ...base, modelId });
    await items.addToKit(admin, kit.id, head.id);
    await items.changeStatus(admin, kit.id, { status: "in_repair", reason: "Dropped", locationId: undefined });
    expect((await items.get(head.id))?.status).toBe("in_repair");
    const childLogs = await prisma.statusLog.findMany({ where: { itemId: head.id }, orderBy: { createdAt: "asc" } });
    expect(childLogs.at(-1)?.reason).toContain("With kit");

    await items.removeFromKit(admin, head.id);
    expect((await items.get(head.id))?.parentItemId).toBeNull();
  });

  it("refuses to put a kit inside itself", async () => {
    const [outer] = await items.create(admin, { ...base, modelId: caseModelId, isKit: true, name: `Outer ${marker}` });
    const [inner] = await items.create(admin, { ...base, modelId: caseModelId, isKit: true, name: `Inner ${marker}` });
    await items.addToKit(admin, outer.id, inner.id);
    await expect(items.addToKit(admin, inner.id, outer.id)).rejects.toThrow(/inside itself/);
    await expect(items.addToKit(admin, outer.id, outer.id)).rejects.toThrow(/itself/);
  });

  it("blocks viewers from writing", async () => {
    await expect(items.create(viewer, { ...base, modelId })).rejects.toThrow(/permission/i);
  });
});
