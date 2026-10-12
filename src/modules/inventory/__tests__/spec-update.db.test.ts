import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { InventoryError, items, locations } from "../service";

/**
 * Spec update (Oct 2026): retiring needs a reason category, "under
 * construction" is a real status, and a person can be a location.
 */
const marker = `spec-${Date.now()}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
let categoryId: string;
let modelId: string;
let itemId: string;
let contactId: string;
let locationId: string | undefined;

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  categoryId = (await prisma.category.create({ data: { name: `Cat ${marker}` } })).id;
  modelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Fixture ${marker}`, trackingType: "serialized" } })).id;
  itemId = (await prisma.item.create({ data: { modelId, assetTag: `TS-${Date.now()}`, status: "in_house" } })).id;
  contactId = (await prisma.contact.create({ data: { kind: "person", name: `Mikkel ${marker}` } })).id;
});

afterAll(async () => {
  if (locationId) await prisma.location.delete({ where: { id: locationId } });
  await prisma.item.deleteMany({ where: { modelId } });
  await prisma.model.delete({ where: { id: modelId } });
  await prisma.category.delete({ where: { id: categoryId } });
  await prisma.contact.delete({ where: { id: contactId } });
  await prisma.activityLog.deleteMany({ where: { summary: { contains: marker } } });
  await prisma.$disconnect();
});

describe("statuses", () => {
  it("under construction is a manual, unavailable status without a reason", async () => {
    await items.changeStatus(admin, itemId, { status: "under_construction", reason: undefined, locationId: undefined, retiredReason: undefined });
    expect((await prisma.item.findUnique({ where: { id: itemId } }))?.status).toBe("under_construction");
    await items.changeStatus(admin, itemId, { status: "in_house", reason: undefined, locationId: undefined, retiredReason: undefined });
  });

  it("retiring needs sold / scrapped / lost and stores it", async () => {
    await expect(items.changeStatus(admin, itemId, { status: "retired", reason: "Sold to Jan", locationId: undefined, retiredReason: undefined })).rejects.toThrow(/sold, scrapped or lost/);
    await items.changeStatus(admin, itemId, { status: "retired", reason: "Sold to Jan Sermuelsen, Aug 2020", locationId: undefined, retiredReason: "sold" });
    const row = await prisma.item.findUnique({ where: { id: itemId } });
    expect(row?.status).toBe("retired");
    expect(row?.retiredReason).toBe("sold");
    await items.changeStatus(admin, itemId, { status: "in_house", reason: "Bought it back", locationId: undefined, retiredReason: undefined });
    expect((await prisma.item.findUnique({ where: { id: itemId } }))?.retiredReason).toBeNull();
  });
});

describe("person locations", () => {
  it("needs a user or contact and links to it", async () => {
    await expect(locations.create(admin, { name: "Nobody", type: "person", parentId: undefined, notes: undefined, person: undefined })).rejects.toBeInstanceOf(InventoryError);
    const loc = await locations.create(admin, { name: `Mikkel ${marker}`, type: "person", parentId: undefined, notes: undefined, person: `contact:${contactId}` });
    locationId = loc.id;
    expect(loc.contactId).toBe(contactId);
    expect(loc.userId).toBeNull();
    const asUser = await locations.update(admin, loc.id, { name: loc.name, type: "person", parentId: undefined, notes: undefined, person: `user:${admin.id}` });
    expect(asUser.userId).toBe(admin.id);
    expect(asUser.contactId).toBeNull();
  });
});
