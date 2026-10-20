import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { InventoryError, items, models, modelUsage } from "../service";
import { familyState } from "../queries";

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

describe("deleting a model", () => {
  it("bulk archives, refuses in-use deletes, and an admin can delete anyway with the cascade", async () => {
    const member: Actor = { id: admin.id, email: "", name: "Test Member", role: "member" };
    const project = await prisma.project.create({ data: { name: `Bulk show ${marker}`, status: "quote" } });
    const spare = await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Spare ${marker}`, trackingType: "bulk" } });
    await prisma.allocation.create({ data: { holderType: "project", projectId: project.id, modelId: spare.id, quantity: 2, startDate: new Date("2034-02-01"), endDate: new Date("2034-02-02") } });
    await prisma.item.create({ data: { modelId: spare.id, assetTag: `BK-${marker}`, quantity: 5, status: "in_house" } });
    const loose = await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Loose ${marker}`, trackingType: "bulk" } });
    try {
      const archived = await models.bulk(member, [spare.id, loose.id], "archive");
      expect(archived.done).toBe(2);
      expect((await prisma.model.findUniqueOrThrow({ where: { id: loose.id } })).archived).toBe(true);
      const del = await models.bulk(member, [spare.id, loose.id], "delete");
      expect(del.done).toBe(1); // loose went, spare is in use
      expect(del.refused).toEqual([{ id: spare.id, label: `Test Spare ${marker}`, summary: "1 item, 1 reservation" }]);
      await expect(models.bulk(member, [spare.id], "delete", { force: true })).rejects.toThrow(); // members cannot force
      const forced = await models.bulk(admin, [spare.id], "delete", { force: true });
      expect(forced.done).toBe(1);
      expect(await prisma.model.findUnique({ where: { id: spare.id } })).toBeNull();
      expect(await prisma.allocation.count({ where: { projectId: project.id } })).toBe(0);
      expect(await prisma.item.count({ where: { assetTag: `BK-${marker}` } })).toBe(0);
    } finally {
      await prisma.allocation.deleteMany({ where: { projectId: project.id } });
      await prisma.project.delete({ where: { id: project.id } });
      await prisma.activityLog.deleteMany({ where: { summary: { contains: marker } } });
    }
  });

  it("refuses to delete a model that a reservation uses, and says so", async () => {
    const project = await prisma.project.create({ data: { name: `Show ${marker}`, status: "quote" } });
    const alloc = await prisma.allocation.create({ data: { holderType: "project", projectId: project.id, modelId: bulkModelId, quantity: 1, startDate: new Date("2034-01-01"), endDate: new Date("2034-01-02") } });
    try {
      const usage = await modelUsage(bulkModelId);
      expect(usage.reservations).toBe(1);
      expect(usage.summary).toContain("1 reservation");
      await expect(models.remove(admin, bulkModelId)).rejects.toThrow(/used by .*1 reservation/);
      expect(await prisma.model.findUnique({ where: { id: bulkModelId } })).not.toBeNull();
    } finally {
      await prisma.allocation.delete({ where: { id: alloc.id } });
      await prisma.project.delete({ where: { id: project.id } });
    }
  });
});

describe("renaming a family", () => {
  it("renames every variant at once and refuses a collision", async () => {
    const a = await prisma.model.create({ data: { categoryId, manufacturer: "", name: `Rods ${marker}`, variant: "50 cm", trackingType: "bulk" } });
    const b = await prisma.model.create({ data: { categoryId, manufacturer: "", name: `Rods ${marker}`, variant: "70 cm", trackingType: "bulk" } });
    const other = await prisma.model.create({ data: { categoryId, manufacturer: "", name: `Stænger ${marker}`, variant: "70 cm", trackingType: "bulk" } });
    const member: Actor = { ...admin, role: "member" };
    await expect(models.editFamily(member, a.id, { manufacturer: "", name: `Stænger ${marker}` })).rejects.toThrow();
    // 70 cm already exists under the new name: refused, nothing changed.
    await expect(models.editFamily(admin, a.id, { manufacturer: "", name: `Stænger ${marker}` })).rejects.toThrow(/already exists/);
    expect((await prisma.model.findUniqueOrThrow({ where: { id: b.id } })).name).toBe(`Rods ${marker}`);
    const r = await models.editFamily(admin, a.id, { manufacturer: "Vertigo", name: `Rør ${marker}` });
    expect(r.count).toBe(2);
    const after = await prisma.model.findMany({ where: { id: { in: [a.id, b.id] } }, orderBy: { variant: "asc" } });
    expect(after.map((m) => [m.manufacturer, m.name, m.variant])).toEqual([
      ["Vertigo", `Rør ${marker}`, "50 cm"],
      ["Vertigo", `Rør ${marker}`, "70 cm"],
    ]);
    expect((await prisma.model.findUniqueOrThrow({ where: { id: other.id } })).name).toBe(`Stænger ${marker}`);
  });

  it("moves a whole family to another category and sets its flags, leaving undecided ones alone", async () => {
    const a = await prisma.model.create({ data: { categoryId, manufacturer: "", name: `Lamp ${marker}`, variant: "575 W", trackingType: "bulk", notForRental: true } });
    const b = await prisma.model.create({ data: { categoryId, manufacturer: "", name: `Lamp ${marker}`, variant: "1200 W", trackingType: "bulk" } });
    const target = await prisma.category.create({ data: { name: `Lamps ${marker}` } });
    try {
      expect(await familyState(a.id)).toEqual({ count: 2, categoryId, notForRental: null, archived: false, consumable: false });
      await models.editFamily(admin, b.id, { manufacturer: "Osram", name: `Lamp ${marker}`, categoryId: target.id, consumable: true });
      const after = await prisma.model.findMany({ where: { id: { in: [a.id, b.id] } }, orderBy: { variant: "asc" } });
      expect(after.map((m) => [m.manufacturer, m.categoryId, m.consumable, m.notForRental])).toEqual([
        ["Osram", target.id, true, false],
        ["Osram", target.id, true, true],
      ]);
      expect(await familyState(a.id)).toMatchObject({ categoryId: target.id, consumable: true, notForRental: null });
      await expect(models.editFamily(admin, a.id, { manufacturer: "Osram", name: `Lamp ${marker}`, categoryId: "nope" })).rejects.toThrow(/category/);
    } finally {
      await prisma.model.deleteMany({ where: { id: { in: [a.id, b.id] } } });
      await prisma.category.delete({ where: { id: target.id } });
    }
  });

  it("keeps metre consumables with stock as consumables", async () => {
    const strip = await prisma.model.create({ data: { categoryId, manufacturer: "", name: `Strip ${marker}`, variant: "24 V", trackingType: "bulk", consumable: true, unit: "m" } });
    await prisma.stockMovement.create({ data: { modelId: strip.id, quantity: 10, kind: "received" } });
    try {
      await expect(models.editFamily(admin, strip.id, { manufacturer: "", name: `Strip ${marker}`, consumable: false })).rejects.toThrow(/must stay consumables/);
      await models.editFamily(admin, strip.id, { manufacturer: "", name: `Strip ${marker}`, notForRental: true });
      expect(await prisma.model.findUniqueOrThrow({ where: { id: strip.id } })).toMatchObject({ consumable: true, unit: "m", notForRental: true });
    } finally {
      await prisma.stockMovement.deleteMany({ where: { modelId: strip.id } });
      await prisma.model.delete({ where: { id: strip.id } });
    }
  });
});
