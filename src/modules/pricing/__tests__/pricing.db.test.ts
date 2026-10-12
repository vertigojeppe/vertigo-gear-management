import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { quoteFor, rentalSubtotals } from "../queries";
import { extraLines, PricingError, quotes, rateTables } from "../service";

/**
 * Integration test: a rate table is created and edited, a rental and a
 * project are priced through it (line snapshot prices, line and document
 * discounts, extra lines, charge-day override), and the list subtotal
 * agrees with the detail quote. Cleans up after itself.
 */
const stamp = Date.now().toString(36);
const marker = `price-${stamp}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
let categoryId: string;
let modelId: string;
let clientId: string;
let rentalId: string;
let projectId: string;
let tableId: string;

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  categoryId = (await prisma.category.create({ data: { name: `Cat ${marker}` } })).id;
  modelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Mover ${marker}`, trackingType: "bulk", rentalDayPrice: 400 } })).id;
  await prisma.item.create({ data: { modelId, assetTag: `TP-${stamp}`, quantity: 10, status: "in_house" } });
  clientId = (await prisma.client.create({ data: { name: `Client ${marker}` } })).id;
  rentalId = (await prisma.rental.create({ data: { clientId, startDate: new Date("2033-03-01"), endDate: new Date("2033-03-03"), status: "reserved" } })).id;
  projectId = (await prisma.project.create({ data: { name: `Show ${marker}`, clientId, status: "quote", reserveFrom: new Date("2033-04-01"), reserveTo: new Date("2033-04-10") } })).id;
});

afterAll(async () => {
  await prisma.rental.deleteMany({ where: { id: rentalId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.item.deleteMany({ where: { modelId } });
  await prisma.model.deleteMany({ where: { id: modelId } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.rateTable.deleteMany({ where: { name: { contains: marker } } });
  await prisma.activityLog.deleteMany({ where: { OR: [{ summary: { contains: marker } }, { entityId: { in: [rentalId, projectId] } }] } });
  await prisma.$disconnect();
});

describe("rate tables", () => {
  it("creates, edits and refuses duplicates", async () => {
    const t = await rateTables.create(admin, { name: `Table ${marker}`, isDefault: false, extraRule: "per_day", extraFactor: 0.2, notes: undefined }, [{ days: 1, factor: 1 }, { days: 3, factor: 2 }]);
    tableId = t.id;
    expect(t.tiers).toEqual([{ days: 1, factor: 1 }, { days: 3, factor: 2 }]);
    expect(t.isDefault).toBe(false); // the seeded Standard table stays the default
    await expect(rateTables.create(admin, { name: `table ${marker}`, isDefault: false, extraRule: "none", extraFactor: undefined, notes: undefined }, [{ days: 1, factor: 1 }])).rejects.toThrow(PricingError);
    const edited = await rateTables.update(admin, t.id, { name: `Table ${marker}`, isDefault: false, extraRule: "per_10_days", extraFactor: 0.5, notes: "edited" }, [{ days: 1, factor: 1 }, { days: 5, factor: 3 }]);
    expect(edited.tiers).toEqual([{ days: 1, factor: 1 }, { days: 5, factor: 3 }]);
    expect(edited.extraRule).toBe("per_10_days");
    expect(await prisma.rateTier.count({ where: { rateTableId: t.id } })).toBe(2);
  });
});

describe("quotes", () => {
  it("prices a rental with the default table, then with its own settings", async () => {
    const line = await prisma.rentalLine.create({ data: { rentalId, modelId, quantity: 2, pricePerDay: 400 } });
    await prisma.allocation.create({ data: { holderType: "rental", rentalId, rentalLineId: line.id, modelId, quantity: 2, startDate: new Date("2033-03-01"), endDate: new Date("2033-03-03") } });
    const q1 = await quoteFor("rental", rentalId);
    expect(q1).not.toBeNull();
    expect(q1!.rateTable?.name).toBe("Standard"); // seeded default
    expect(q1!.rateTableOverridden).toBe(false);
    expect(q1!.windowDays).toBe(3);
    expect(q1!.chargeDays).toBe(3);
    expect(q1!.totals.factor).toBe(2);
    expect(q1!.gearLines[0]).toMatchObject({ quantity: 2, dayPrice: 400, listDayPrice: 400, gross: 1600, net: 1600 });
    expect(q1!.totals).toMatchObject({ linesTotal: 1600, subtotal: 1600, vat: 400, total: 2000 });

    await quotes.setSettings(admin, { kind: "rental", id: rentalId }, { rateTableId: tableId, chargeDays: 15, discountPct: 10, terms: "Net 8 days" });
    await extraLines.add(admin, { kind: "rental", id: rentalId }, { description: "Freight", quantity: 1, unitPrice: 500, discountPct: undefined });
    const q2 = (await quoteFor("rental", rentalId))!;
    expect(q2.rateTable?.id).toBe(tableId);
    expect(q2.chargeDaysOverridden).toBe(true);
    expect(q2.totals.factor).toBe(3.5); // 15 days: tier 5 (3) + 0.5 per started 10 days
    expect(q2.gearLines[0].net).toBe(2800);
    expect(q2.extraLines[0]).toMatchObject({ description: "Freight", net: 500 });
    expect(q2.totals).toMatchObject({ linesTotal: 3300, documentDiscount: 330, subtotal: 2970, vat: 742.5, total: 3712.5 });
    expect(q2.terms).toBe("Net 8 days");

    const rows = await prisma.rental.findMany({ where: { id: rentalId }, include: { lines: true, extraLines: true } });
    expect((await rentalSubtotals(rows)).get(rentalId)).toBe(2970);
  });

  it("prices a project from its reservations and refuses deleting a table in use", async () => {
    await prisma.allocation.create({ data: { holderType: "project", projectId, modelId, quantity: 3, startDate: new Date("2033-04-01"), endDate: new Date("2033-04-10"), pricePerDay: 400, discountPct: 50 } });
    await quotes.setSettings(admin, { kind: "project", id: projectId }, { rateTableId: tableId, chargeDays: undefined, discountPct: undefined, terms: undefined });
    const q = (await quoteFor("project", projectId))!;
    expect(q.holder.title).toBe(`Show ${marker}`);
    expect(q.client?.name).toBe(`Client ${marker}`);
    expect(q.windowDays).toBe(10);
    expect(q.totals.factor).toBe(3.5); // 10 days on the edited table: 3 + 0.5
    expect(q.gearLines[0]).toMatchObject({ quantity: 3, dayPrice: 400, discountPct: 50, gross: 4200, discount: 2100, net: 2100 });
    expect(q.totals.subtotal).toBe(2100);
    await expect(rateTables.remove(admin, tableId)).rejects.toThrow(/used by/);
  });

  it("extra lines belong to their holder", async () => {
    const l = await extraLines.add(admin, { kind: "project", id: projectId }, { description: "Crew", quantity: 2, unitPrice: 3000, discountPct: 10 });
    await expect(extraLines.remove(admin, { kind: "rental", id: rentalId }, l.id)).rejects.toThrow(PricingError);
    await extraLines.update(admin, { kind: "project", id: projectId }, l.id, { description: "Crew (2 days)", quantity: 2, unitPrice: 3000, discountPct: undefined });
    const q = (await quoteFor("project", projectId))!;
    expect(q.extraLines.map((x) => [x.description, x.net])).toEqual([["Crew (2 days)", 6000]]);
    await extraLines.remove(admin, { kind: "project", id: projectId }, l.id);
    expect((await quoteFor("project", projectId))!.extraLines).toHaveLength(0);
  });
});
