import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { applyOps, type CreatedIds } from "../commit";
import { readWorkbook } from "../parse";
import { buildPlan, modelKey, resolveOps } from "../plan";
import { importer } from "../service";
import { fixtureBytes } from "./fixture";

/**
 * Integration test against the dev database: the fixture workbook is
 * planned and applied, the rows land with their statuses, locations,
 * custom fields and sources, and a second run of the same file writes
 * nothing. Everything created is removed afterwards via the ids the
 * import's ActivityLog row records.
 */
const M = `imp-${Date.now().toString(36)}`;
const fileName = `fixture ${M}.xlsx`;
const admin: Actor = { id: "", email: "", name: "Alex Admin", role: "admin" };
const created: CreatedIds[] = [];

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
});

afterAll(async () => {
  for (const c of created.reverse()) {
    await prisma.allocation.deleteMany({ where: { rentalId: { in: c.rentals } } });
    await prisma.rental.deleteMany({ where: { id: { in: c.rentals } } });
    await prisma.location.deleteMany({ where: { renterId: { in: c.clients } } });
    await prisma.client.deleteMany({ where: { id: { in: c.clients } } });
    await prisma.item.deleteMany({ where: { id: { in: c.items } } });
    await prisma.model.deleteMany({ where: { id: { in: c.models } } });
    await prisma.location.deleteMany({ where: { id: { in: c.locations } } });
    await prisma.contact.deleteMany({ where: { id: { in: c.contacts } } });
    for (const id of [...c.categories].reverse()) await prisma.category.delete({ where: { id } }).catch(() => undefined);
  }
  await prisma.activityLog.deleteMany({ where: { action: "spreadsheet_imported", summary: { contains: M } } });
  await prisma.$disconnect();
});

describe("importer commit", () => {
  it("writes the plan and records every id", async () => {
    const wb = await readWorkbook(await fixtureBytes(M), fileName);
    const plan = buildPlan(wb, await importer.context());
    const result = await applyOps(admin, resolveOps(plan, {}), fileName);
    created.push(result.created);

    expect(result.skipped).toEqual([]);
    expect(result.kits).toBe(2);
    expect(result.rentals).toBe(1);
    expect(result.units).toBe(4 + 2 + 2 + 3 + 4); // controllers, projectors, KITO, fobs, EclGallery

    const true1 = await prisma.model.findFirstOrThrow({ where: { name: `True1 ${M} kabler 5 m` }, include: { category: { include: { parent: true } }, items: { orderBy: { quantity: "desc" } } } });
    expect(true1).toMatchObject({ manufacturer: "Generic", trackingType: "bulk", rentalDayPrice: expect.anything(), importSource: "LED - SCROLLER - BOX!F6" });
    expect(Number(true1.weightKg)).toBe(0.5);
    expect(Number(true1.rentalDayPrice)).toBe(25);
    expect(true1.category.name).toBe(`True1 ${M}`);
    expect(true1.category.parent?.name).toBe("Cables");
    expect(true1.items.map((i) => [i.quantity, i.status])).toEqual([
      [9, "in_house"],
      [1, "in_repair"],
    ]);
    expect(true1.items[0].assetTag).toMatch(/^VG-\d{4}$/);

    const ukirke = await prisma.contact.findFirstOrThrow({ where: { name: "ukirke", locations: { some: {} } }, include: { locations: true } });
    expect(ukirke.locations[0]).toMatchObject({ type: "person", name: "ukirke" });
    const lent = await prisma.item.findFirstOrThrow({ where: { locationId: ukirke.locations[0].id, model: { name: `True1 ${M} kabler 10 m` } } });
    expect(lent.quantity).toBe(2);

    const split = await prisma.model.findFirstOrThrow({ where: { name: `SplitLED ${M} 60cm` } });
    expect(split.powerDrawW).toBe(1150);
    const kits = await prisma.item.findMany({ where: { id: { in: result.created.items }, isKit: true } });
    expect(kits.map((k) => k.name).sort()).toEqual(["SplitLED flightcase 1", "SplitLED flightcase 2"]);

    const n4 = await prisma.item.findFirstOrThrow({ where: { assetTag: "N4-01" }, include: { model: true, statusLogs: true } });
    expect(n4).toMatchObject({ status: "in_repair", conditionNotes: "ERROR no output", customFields: { ip_address: "192.168.1.20", board_type: "Teensy 3.2" } });
    expect(n4.model.name).toBe("BlackLED controller 4 udgange (200w)");
    expect(n4.statusLogs[0]).toMatchObject({ toStatus: "in_repair", reason: `Imported from ${fileName}` });
    expect((await prisma.item.findFirstOrThrow({ where: { assetTag: "W6-02" } })).notes).toBe("Sheet column M: ID: N4-01");

    const p1 = await prisma.item.findFirstOrThrow({ where: { assetTag: "P1" }, include: { location: { include: { contact: true } }, model: true } });
    expect(p1.serialNumber).toBe("ABCDEFGHIJ12");
    expect(p1.location?.contact?.name).toBe("Lasse");
    expect(p1.model.customFields).toMatchObject({ lumen: 4500, throw_ratio: "1.2:1", resolution: "WUXGA" });
    const p2 = await prisma.item.findFirstOrThrow({ where: { assetTag: "P2" } });
    expect(p2).toMatchObject({ status: "retired", retiredReason: "sold", notForRental: true, locationId: null });

    const fob1 = await prisma.item.findFirstOrThrow({ where: { assetTag: "U00001" }, include: { location: true } });
    expect(fob1.location).toMatchObject({ type: "person", userId: admin.id });
    expect((await prisma.item.findFirstOrThrow({ where: { assetTag: "U00002" } })).status).toBe("missing");

    const rental = await prisma.rental.findFirstOrThrow({ where: { id: { in: result.created.rentals } }, include: { client: true, lines: { include: { model: true, allocation: true } } } });
    expect(rental).toMatchObject({ status: "out", startDate: new Date("2021-10-12T00:00:00Z") });
    expect(rental.client.name).toBe(`Testperson ${M}`);
    expect(rental.lines).toHaveLength(1);
    expect(rental.lines[0].model.name).toBe("EclGalleryProfile FC 60W RGBW");
    expect(rental.lines[0].allocation).toMatchObject({ quantity: 4, holderType: "rental" });
    expect(await prisma.location.findFirst({ where: { renterId: rental.clientId } })).toMatchObject({ type: "renter" });

    const log = await prisma.activityLog.findFirstOrThrow({ where: { action: "spreadsheet_imported", summary: { contains: M } } });
    expect((log.details as { created: CreatedIds }).created.items).toEqual(result.created.items);
  });

  it("writes nothing when the same file is imported again", async () => {
    const wb = await readWorkbook(await fixtureBytes(M), fileName);
    const ctx = await importer.context();
    expect(ctx.existingTags.has("W6-01")).toBe(true);
    expect(ctx.existingModels.has(modelKey("Generic", `True1 ${M} kabler 5 m`))).toBe(true);
    const plan = buildPlan(wb, ctx);
    expect(plan.rows.find((r) => r.key === "LED - SCROLLER - BOX:6")?.bucket).toBe("decision");
    const result = await applyOps(admin, resolveOps(plan, { "loan:1": "closed" }), fileName);
    created.push(result.created);
    expect(result).toMatchObject({ categories: 0, models: 0, units: 0, bins: 0, kits: 0, contacts: 0, locations: 0, rentals: 0 });
  });

  it("adds units to an existing model when told to", async () => {
    const wb = await readWorkbook(await fixtureBytes(M), fileName);
    const plan = buildPlan(wb, await importer.context());
    const key = modelKey("Generic", `True1 ${M} kabler 5 m`);
    const ops = resolveOps(plan, { "LED - SCROLLER - BOX:6": "add", "loan:1": "closed" }).filter((o) => "modelKey" in o && o.modelKey === key);
    const result = await applyOps(admin, ops, fileName);
    created.push(result.created);
    expect(result).toMatchObject({ models: 0, bins: 2 });
    expect(await prisma.item.count({ where: { model: { name: `True1 ${M} kabler 5 m` } } })).toBe(4);
  });
});
