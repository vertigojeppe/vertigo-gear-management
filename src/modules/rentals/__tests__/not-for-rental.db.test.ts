import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { RentalError, rentalLines } from "../service";

/** Gear flagged "not for rental" cannot go on a rental, at model or unit level. */
const marker = `nfr-${Date.now()}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
let categoryId: string;
let ownOnlyModelId: string;
let rentableModelId: string;
let flaggedUnitId: string;
let clientId: string;
let rentalId: string;

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  categoryId = (await prisma.category.create({ data: { name: `Cat ${marker}` } })).id;
  ownOnlyModelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Vertigo", name: `QLED ${marker}`, trackingType: "serialized", notForRental: true } })).id;
  rentableModelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Mover ${marker}`, trackingType: "serialized" } })).id;
  await prisma.item.create({ data: { modelId: ownOnlyModelId, assetTag: `NF-${Date.now()}a`, status: "in_house" } });
  await prisma.item.create({ data: { modelId: rentableModelId, assetTag: `NF-${Date.now()}b`, status: "in_house" } });
  flaggedUnitId = (await prisma.item.create({ data: { modelId: rentableModelId, assetTag: `NF-${Date.now()}c`, status: "in_house", notForRental: true } })).id;
  clientId = (await prisma.client.create({ data: { name: `Client ${marker}` } })).id;
  rentalId = (await prisma.rental.create({ data: { clientId, status: "reserved", startDate: new Date("2033-03-01"), endDate: new Date("2033-03-03") } })).id;
});

afterAll(async () => {
  await prisma.rental.deleteMany({ where: { clientId } });
  await prisma.location.deleteMany({ where: { renterId: clientId } });
  await prisma.client.delete({ where: { id: clientId } });
  await prisma.item.deleteMany({ where: { modelId: { in: [ownOnlyModelId, rentableModelId] } } });
  await prisma.model.deleteMany({ where: { id: { in: [ownOnlyModelId, rentableModelId] } } });
  await prisma.category.delete({ where: { id: categoryId } });
  await prisma.activityLog.deleteMany({ where: { summary: { contains: marker } } });
  await prisma.$disconnect();
});

describe("not for rental", () => {
  const line = { quantity: 1, pricePerDay: undefined, pricePerWeek: undefined, note: undefined, force: false };

  it("refuses a model flagged not for rental", async () => {
    await expect(rentalLines.add(admin, rentalId, { ...line, modelId: ownOnlyModelId })).rejects.toBeInstanceOf(RentalError);
  });

  it("accepts a rentable model but refuses a flagged unit of it", async () => {
    const { line: row } = await rentalLines.add(admin, rentalId, { ...line, modelId: rentableModelId });
    await expect(rentalLines.assignItem(admin, row.id, flaggedUnitId)).rejects.toThrow(/not for rental/);
    await expect(rentalLines.update(admin, row.id, { ...line, modelId: ownOnlyModelId })).rejects.toBeInstanceOf(RentalError);
  });
});
