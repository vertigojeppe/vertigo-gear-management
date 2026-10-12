import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { PackingError, packingChecks, packingLines, packingLists, packingTemplates, shareLinks, undoCheckIn } from "../service";
import { listDetail } from "../queries";

/**
 * Integration test: a packing list goes draft → checked_out → checked_in.
 * Serialized units change status and location, bulk quantities split off a
 * travel bin and merge back, a kit line cascades to its contents, a partial
 * return leaves the rest as missing, and the share token resolves.
 */
const stamp = Date.now();
const marker = `pack-${stamp}`;
// Tags must look like real asset tags (letters-digits) for scanning to find them.
const tag = (n: number) => `TP-${stamp}${n}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
let categoryId: string;
let moverModelId: string;
let cableModelId: string;
let caseModelId: string;
let homeId: string;
let projectId: string;
let listId: string;
const moverIds: string[] = [];
let binId: string;
let kitId: string;
let kitChildId: string;

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  categoryId = (await prisma.category.create({ data: { name: `Cat ${marker}` } })).id;
  homeId = (await prisma.location.create({ data: { name: `Shelf ${marker}`, type: "warehouse" } })).id;
  moverModelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Mover ${marker}`, trackingType: "serialized", weightKg: 10, powerDrawW: 200 } })).id;
  cableModelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Cable ${marker}`, trackingType: "bulk", weightKg: 0.5 } })).id;
  caseModelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Case ${marker}`, trackingType: "serialized", weightKg: 5 } })).id;
  for (let i = 0; i < 3; i++) {
    moverIds.push((await prisma.item.create({ data: { modelId: moverModelId, assetTag: tag(i), status: "in_house", locationId: homeId, homeLocationId: homeId } })).id);
  }
  binId = (await prisma.item.create({ data: { modelId: cableModelId, assetTag: tag(7), quantity: 20, status: "in_house", locationId: homeId, homeLocationId: homeId } })).id;
  kitId = (await prisma.item.create({ data: { modelId: caseModelId, assetTag: tag(8), isKit: true, name: `Kit ${marker}`, status: "in_house", locationId: homeId, homeLocationId: homeId } })).id;
  kitChildId = (await prisma.item.create({ data: { modelId: moverModelId, assetTag: tag(9), status: "in_house", locationId: homeId, homeLocationId: homeId, parentItemId: kitId } })).id;
  projectId = (await prisma.project.create({ data: { name: `Packing show ${marker}`, status: "confirmed" } })).id;
  await prisma.allocation.create({ data: { holderType: "project", projectId, modelId: moverModelId, quantity: 2, startDate: new Date("2031-01-01"), endDate: new Date("2031-01-03") } });
});

afterAll(async () => {
  await prisma.outbox.deleteMany({ where: { payload: { path: ["projectId"], equals: projectId } } });
  await prisma.shareLink.deleteMany({ where: { targetId: listId } });
  await prisma.packingList.deleteMany({ where: { projectId } });
  await prisma.packingTemplate.deleteMany({ where: { name: { contains: marker } } });
  await prisma.location.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } });
  await prisma.item.deleteMany({ where: { modelId: { in: [moverModelId, cableModelId, caseModelId] } } });
  await prisma.model.deleteMany({ where: { id: { in: [moverModelId, cableModelId, caseModelId] } } });
  await prisma.category.delete({ where: { id: categoryId } });
  await prisma.location.delete({ where: { id: homeId } });
  await prisma.activityLog.deleteMany({ where: { summary: { contains: marker } } });
  await prisma.$disconnect();
});

describe("packing list lifecycle", () => {
  it("creates a list from the project reservations", async () => {
    const list = await packingLists.create(admin, projectId, { name: `List ${marker}`, groupBy: "category", notes: undefined, source: "reservations", sourceId: undefined });
    listId = list.id;
    const detail = await listDetail(listId);
    expect(detail?.lines).toHaveLength(1);
    expect(detail?.lines[0].quantity).toBe(2);
    expect(detail?.progress.units).toBe(2);
  });

  it("merges a plain line of the same model, and adds bulk and kit lines", async () => {
    await packingLines.add(admin, listId, { modelId: moverModelId, quantity: 1, note: undefined, caseItemId: undefined });
    await packingLines.add(admin, listId, { modelId: cableModelId, quantity: 5, note: undefined, caseItemId: undefined });
    await packingLines.addKit(admin, listId, kitId);
    await expect(packingLines.addKit(admin, listId, kitId)).rejects.toBeInstanceOf(PackingError);
    // 4 movers exist (3 loose + 1 in the kit) and 3 are on the list: no room for 2 more.
    await expect(packingLines.add(admin, listId, { modelId: moverModelId, quantity: 2, note: undefined, caseItemId: undefined })).rejects.toThrow(/Only 4 .* exist/);
    // The bin holds 20 cables and 5 are on the list.
    await expect(packingLines.add(admin, listId, { modelId: cableModelId, quantity: 16, note: undefined, caseItemId: undefined })).rejects.toThrow(/Only 20 .* exist/);
    const stock = (await listDetail(listId))!.lines.find((l) => l.modelId === moverModelId && !l.isKit)!;
    expect(stock.owned).toBe(4);
    expect(stock.inHouse).toBe(4);
    const detail = await listDetail(listId);
    expect(detail?.lines).toHaveLength(3);
    const mover = detail!.lines.find((l) => l.modelId === moverModelId && !l.isKit)!;
    expect(mover.quantity).toBe(3);
    expect(detail?.progress.units).toBe(9);
    // 3 movers + 5 cables + the kit case + the mover inside the kit
    expect(detail?.totals.weightKg).toBe(3 * 10 + 5 * 0.5 + 5 + 10);
    expect(detail?.totals.cases).toBe(1);
    expect(detail?.totals.powerW).toBe(800);
  });

  it("refuses to check out with nothing packed", async () => {
    await expect(packingLists.checkOut(admin, listId)).rejects.toBeInstanceOf(PackingError);
  });

  it("ticks units by scan, refuses wrong model / duplicates / units not in house", async () => {
    const detail = await listDetail(listId);
    const mover = detail!.lines.find((l) => l.modelId === moverModelId && !l.isKit)!;
    const r1 = await packingChecks.scan(admin, listId, tag(0));
    expect(r1.status).toBe("ticked");
    await expect(packingChecks.tick(admin, { lineId: mover.id, itemId: moverIds[0], quantity: undefined })).rejects.toThrow(/already packed/);
    await expect(packingChecks.tick(admin, { lineId: mover.id, itemId: binId, quantity: undefined })).rejects.toThrow(/different model/);
    await prisma.item.update({ where: { id: moverIds[2] }, data: { status: "in_repair" } });
    await expect(packingChecks.tick(admin, { lineId: mover.id, itemId: moverIds[2], quantity: undefined })).rejects.toThrow(/in repair/);
    await packingChecks.tick(admin, { lineId: mover.id, itemId: moverIds[1], quantity: undefined });
    const unknown = await packingChecks.scan(admin, listId, "VG-9999999");
    expect(unknown.status).toBe("unknown");
    // Kit line is ticked by scanning the case; its contents follow it.
    const kit = await packingChecks.scan(admin, listId, tag(8));
    expect(kit.status).toBe("ticked");
    // Bulk: take 5 out of the 20 in the bin (asking for 50 is capped at the line).
    const cable = detail!.lines.find((l) => l.modelId === cableModelId)!;
    await expect(packingChecks.tick(admin, { lineId: cable.id, itemId: binId, quantity: 50 })).resolves.toMatchObject({ quantity: 5 });
    const after = await listDetail(listId);
    expect(after?.progress.packed).toBe(8);
    expect(after?.progress.toPack).toBe(1);
  });

  it("untick removes the check while still a draft", async () => {
    const detail = await listDetail(listId);
    const mover = detail!.lines.find((l) => l.modelId === moverModelId && !l.isKit)!;
    const check = mover.checks.find((c) => c.itemId === moverIds[1])!;
    await packingChecks.untick(admin, check.id);
    await packingChecks.tick(admin, { lineId: mover.id, itemId: moverIds[1], quantity: undefined });
  });

  it("check-out moves units to on_project, splits a travel bin, cascades the kit", async () => {
    const list = await packingLists.checkOut(admin, listId);
    expect(list.status).toBe("checked_out");
    const projectLoc = await prisma.location.findFirst({ where: { projectId } });
    const m0 = await prisma.item.findUnique({ where: { id: moverIds[0] } });
    expect(m0?.status).toBe("on_project");
    expect(m0?.locationId).toBe(projectLoc?.id);
    const bin = await prisma.item.findUnique({ where: { id: binId } });
    expect(bin?.quantity).toBe(15);
    const travel = await prisma.item.findFirst({ where: { modelId: cableModelId, id: { not: binId } } });
    expect(travel?.quantity).toBe(5);
    expect(travel?.status).toBe("on_project");
    expect(travel?.homeLocationId).toBe(homeId);
    const child = await prisma.item.findUnique({ where: { id: kitChildId } });
    expect(child?.status).toBe("on_project");
    // Lines are frozen now.
    await expect(packingLines.add(admin, listId, { modelId: moverModelId, quantity: 1, note: undefined, caseItemId: undefined })).rejects.toBeInstanceOf(PackingError);
    await expect(packingLists.remove(admin, listId)).rejects.toBeInstanceOf(PackingError);
  });

  it("partial check-in: ok goes home, damaged goes to repair, bulk merges back", async () => {
    const detail = await listDetail(listId);
    const mover = detail!.lines.find((l) => l.modelId === moverModelId && !l.isKit)!;
    const out0 = mover.checks.find((c) => c.phase === "out" && c.itemId === moverIds[0])!;
    const out1 = mover.checks.find((c) => c.phase === "out" && c.itemId === moverIds[1])!;
    await packingChecks.checkIn(admin, { outCheckId: out0.id, outcome: "ok", quantity: undefined, note: undefined });
    await packingChecks.checkIn(admin, { outCheckId: out1.id, outcome: "damaged", quantity: undefined, note: "Broken pan motor" });
    await expect(packingChecks.checkIn(admin, { outCheckId: out0.id, outcome: "ok", quantity: undefined, note: undefined })).rejects.toThrow(/Already/);
    const m0 = await prisma.item.findUnique({ where: { id: moverIds[0] } });
    expect(m0?.status).toBe("in_house");
    expect(m0?.locationId).toBe(homeId);
    expect((await prisma.item.findUnique({ where: { id: moverIds[1] } }))?.status).toBe("in_repair");

    const cable = detail!.lines.find((l) => l.modelId === cableModelId)!;
    const outCable = cable.checks.find((c) => c.phase === "out")!;
    await packingChecks.checkIn(admin, { outCheckId: outCable.id, outcome: "ok", quantity: 3, note: undefined });
    expect((await prisma.item.findUnique({ where: { id: binId } }))?.quantity).toBe(18);
    const travel = await prisma.item.findFirst({ where: { modelId: cableModelId, id: { not: binId } } });
    expect(travel?.quantity).toBe(2);
    const mid = await listDetail(listId);
    expect(mid?.progress.toReturn).toBe(3); // kit + 2 cables
  });

  it("a wrong return can be undone and redone", async () => {
    const detail = await listDetail(listId);
    const mover = detail!.lines.find((l) => l.modelId === moverModelId && !l.isKit)!;
    const damagedIn = mover.checks.find((c) => c.phase === "in" && c.itemId === moverIds[1])!;
    await undoCheckIn(admin, damagedIn.id);
    const m1 = await prisma.item.findUnique({ where: { id: moverIds[1] } });
    expect(m1?.status).toBe("on_project");
    const projectLoc = await prisma.location.findFirst({ where: { projectId } });
    expect(m1?.locationId).toBe(projectLoc?.id);

    const cable = detail!.lines.find((l) => l.modelId === cableModelId)!;
    const cableIn = cable.checks.find((c) => c.phase === "in")!;
    await undoCheckIn(admin, cableIn.id);
    expect((await prisma.item.findUnique({ where: { id: binId } }))?.quantity).toBe(15);
    const travel = await prisma.item.findFirst({ where: { modelId: cableModelId, id: { not: binId } } });
    expect(travel).toMatchObject({ quantity: 5, status: "on_project" });
    expect((await listDetail(listId))?.progress.toReturn).toBe(7);

    // Redo both so the rest of the lifecycle is unchanged.
    const again = await listDetail(listId);
    const out1 = again!.lines.find((l) => l.modelId === moverModelId && !l.isKit)!.checks.find((c) => c.phase === "out" && c.itemId === moverIds[1])!;
    await packingChecks.checkIn(admin, { outCheckId: out1.id, outcome: "damaged", quantity: undefined, note: "Broken pan motor" });
    const outCable = again!.lines.find((l) => l.modelId === cableModelId)!.checks.find((c) => c.phase === "out")!;
    await packingChecks.checkIn(admin, { outCheckId: outCable.id, outcome: "ok", quantity: 3, note: undefined });
    expect((await listDetail(listId))?.progress.toReturn).toBe(3);
  });

  it("finish check-in marks the rest missing and closes the list", async () => {
    const list = await packingLists.finishCheckIn(admin, listId);
    expect(list.status).toBe("checked_in");
    const detail = await listDetail(listId);
    expect(detail?.progress.toReturn).toBe(0);
    expect(detail?.progress.missing).toBe(3);
    expect(detail?.progress.damaged).toBe(1);
    expect((await prisma.item.findUnique({ where: { id: kitId } }))?.status).toBe("missing");
    expect((await prisma.item.findUnique({ where: { id: kitChildId } }))?.status).toBe("missing");
    const travel = await prisma.item.findFirst({ where: { modelId: cableModelId, id: { not: binId } } });
    expect(travel?.status).toBe("missing");
    expect(travel?.quantity).toBe(2);
    await expect(packingChecks.tick(admin, { lineId: detail!.lines[0].id, itemId: moverIds[2], quantity: undefined })).rejects.toBeInstanceOf(PackingError);
  });

  it("saves the list as a template (plain lines only) and applies it to a new list", async () => {
    const tpl = await packingTemplates.createFromList(admin, listId, `Template ${marker}`);
    const rows = await prisma.packingTemplateLine.findMany({ where: { templateId: tpl.id } });
    expect(rows).toHaveLength(2);
    // A template asking for more than exists is clamped to what is owned.
    await prisma.packingTemplateLine.updateMany({ where: { templateId: tpl.id, modelId: moverModelId }, data: { quantity: 10 } });
    const copy = await packingLists.create(admin, projectId, { name: `Copy ${marker}`, groupBy: "case", notes: undefined, source: "template", sourceId: tpl.id });
    const detail = await listDetail(copy.id);
    expect(detail?.lines.map((l) => l.quantity).sort()).toEqual([4, 5]);
    await packingLists.remove(admin, copy.id);
  });

  it("share links resolve by token, and revoke removes them", async () => {
    const link = await shareLinks.ensure(admin, "packing_list", listId);
    expect((await shareLinks.ensure(admin, "packing_list", listId)).id).toBe(link.id);
    expect((await shareLinks.resolve(link.token))?.targetId).toBe(listId);
    await shareLinks.revoke(admin, "packing_list", listId);
    expect(await shareLinks.resolve(link.token)).toBeNull();
    const viewer: Actor = { ...admin, role: "viewer" };
    await expect(shareLinks.ensure(viewer, "packing_list", listId)).rejects.toThrow();
  });
});
