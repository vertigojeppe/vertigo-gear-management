import { randomBytes } from "node:crypto";
import { prisma, type Db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { nextAssetTag, normaliseAssetTag } from "@/lib/asset-tag";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { emitEvent } from "@/lib/events";
// The barrel re-exports server actions (next-auth), which cannot load under Vitest.
// eslint-disable-next-line no-restricted-imports
import { items as inventoryItems } from "@/modules/inventory/service";
import { type CheckOutcome, type PackingStatus } from "../../../config/app.config";
import { canCheckIn, canCheckOut, canEditLines, canPack, lineProgress, listProgress, outcomeItemStatus } from "./logic";
import type { CheckInInput, LineInput, LineUpdateInput, PackingListInput, TemplateInput, TemplateLineInput, TickInput } from "./schema";
import { modelLabel } from "@/lib/format";

export class PackingError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "PackingError";
  }
}

type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

async function loadList(listId: string) {
  const list = await prisma.packingList.findUnique({ where: { id: listId }, include: { project: true } });
  if (!list) throw new PackingError("Packing list not found.");
  return list;
}

function lineLabel(line: { quantity: number; model: { manufacturer: string; name: string } }) {
  return `${line.quantity}× ${modelLabel(line.model)}`;
}

/**
 * How many of a model exist (any status except retired) and how many are
 * in house right now. Bulk counts quantities; serialized counts units,
 * including those inside kits.
 */
export async function modelStock(modelId: string): Promise<{ owned: number; inHouse: number }> {
  const rows = await prisma.item.groupBy({ by: ["status"], where: { modelId }, _sum: { quantity: true } });
  let owned = 0;
  let inHouse = 0;
  for (const r of rows) {
    const q = r._sum.quantity ?? 0;
    if (r.status !== "retired") owned += q;
    if (r.status === "in_house") inHouse += q;
  }
  return { owned, inHouse };
}

async function projectLocationId(projectId: string, tx: Tx | Db = prisma): Promise<string> {
  const loc = await tx.location.findFirst({ where: { projectId } });
  if (loc) return loc.id;
  const p = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
  return (await tx.location.create({ data: { name: p.name, type: "project", projectId } })).id;
}

/* ------------------------------------------------------------------------ */
/* Lists                                                                    */
/* ------------------------------------------------------------------------ */

export const packingLists = {
  /** "Not this time": hide a spare suggestion on this list. */
  async dismissSpare(actor: Actor, listId: string, partId: string) {
    assertCan(actor, "packing.write");
    const list = await prisma.packingList.findUniqueOrThrow({ where: { id: listId }, select: { dismissedSpares: true } });
    const current = Array.isArray(list.dismissedSpares) ? (list.dismissedSpares as string[]) : [];
    if (current.includes(partId)) return;
    await prisma.packingList.update({ where: { id: listId }, data: { dismissedSpares: [...current, partId] } });
  },

  async create(actor: Actor, projectId: string, input: PackingListInput) {
    assertCan(actor, "packing.write");
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new PackingError("Project not found.");
    const list = await prisma.packingList.create({ data: { projectId, name: input.name, groupBy: input.groupBy, notes: input.notes ?? null } });
    await logActivity(actor, { entityType: "project", entityId: projectId, action: "packing_list_created", summary: `Created packing list "${list.name}"` });
    if (input.source === "reservations") await packingLines.addFromReservations(actor, list.id);
    if (input.source === "template" && input.sourceId) await packingLines.applyTemplate(actor, list.id, input.sourceId);
    if (input.source === "copy" && input.sourceId) await packingLines.copyFrom(actor, list.id, input.sourceId);
    return list;
  },

  async update(actor: Actor, listId: string, input: Pick<PackingListInput, "name" | "groupBy" | "notes">) {
    assertCan(actor, "packing.write");
    const list = await prisma.packingList.update({ where: { id: listId }, data: { name: input.name, groupBy: input.groupBy, notes: input.notes ?? null } });
    await logActivity(actor, { entityType: "project", entityId: list.projectId, action: "packing_list_updated", summary: `Updated packing list "${list.name}"` });
    return list;
  },

  async remove(actor: Actor, listId: string) {
    assertCan(actor, "packing.write");
    const list = await loadList(listId);
    if (list.status === "checked_out") throw new PackingError("Gear is out on this list. Check it in first.");
    await prisma.shareLink.deleteMany({ where: { targetType: "packing_list", targetId: listId } });
    await prisma.packingList.delete({ where: { id: listId } });
    await logActivity(actor, { entityType: "project", entityId: list.projectId, action: "packing_list_deleted", summary: `Deleted packing list "${list.name}"` });
  },

  /**
   * Check out: everything ticked leaves the warehouse. Serialized units go
   * to on_project at the project location; bulk quantities split off a
   * travel bin. Unticked lines stay as "not packed" on the list.
   */
  async checkOut(actor: Actor, listId: string) {
    assertCan(actor, "packing.write");
    const list = await loadList(listId);
    const lines = await prisma.packingLine.findMany({ where: { listId }, include: { model: true, checks: true } });
    const progress = listProgress(lines.map((l) => ({ quantity: l.quantity, trackingType: l.model.trackingType === "bulk" ? "bulk" : "serialized", checks: l.checks.map((c) => ({ phase: c.phase as "out" | "in", quantity: c.quantity, outcome: c.outcome })) })));
    if (!canCheckOut(list.status as PackingStatus, progress)) throw new PackingError("Nothing is packed yet, or the list is not a draft.");
    const locationId = await projectLocationId(list.projectId);
    const reason = `Checked out: ${list.project.name}`;

    for (const line of lines) {
      for (const check of line.checks.filter((c) => c.phase === "out")) {
        if (line.model.trackingType === "bulk") {
          await prisma.$transaction(async (tx) => {
            const source = check.sourceItemId ? await tx.item.findUnique({ where: { id: check.sourceItemId } }) : null;
            if (source) {
              await tx.item.update({ where: { id: source.id }, data: { quantity: Math.max(0, source.quantity - check.quantity) } });
            }
            const travel = await tx.item.create({
              data: {
                modelId: line.modelId,
                assetTag: await nextAssetTag(tx),
                quantity: check.quantity,
                status: "on_project",
                locationId,
                homeLocationId: source?.homeLocationId ?? source?.locationId ?? null,
                notes: source ? `Travel bin from ${source.assetTag} (${list.project.name})` : `Travel bin (${list.project.name})`,
                statusLogs: { create: { fromStatus: null, toStatus: "on_project", reason, userId: actor.id } },
              },
            });
            await tx.packingCheck.update({ where: { id: check.id }, data: { itemId: travel.id } });
          });
        } else if (check.itemId) {
          await inventoryItems.changeStatus(actor, check.itemId, { status: "on_project", reason, locationId }, { viaFlow: true });
        }
      }
    }
    const updated = await prisma.packingList.update({ where: { id: listId }, data: { status: "checked_out", checkedOutAt: new Date() } });
    await logActivity(actor, { entityType: "project", entityId: list.projectId, action: "checked_out", summary: `Checked out "${list.name}" (${progress.packed} units)` });
    await emitEvent("packing.checked_out", { listId, projectId: list.projectId, project: list.project.name, units: progress.packed, by: actor.name });
    return updated;
  },

  /** Finish check-in: anything still out is recorded as missing. */
  async finishCheckIn(actor: Actor, listId: string) {
    assertCan(actor, "packing.write");
    const list = await loadList(listId);
    if (!canCheckIn(list.status as PackingStatus)) throw new PackingError("This list is not checked out.");
    const lines = await prisma.packingLine.findMany({ where: { listId }, include: { model: true, checks: true } });
    let autoMissing = 0;
    for (const line of lines) {
      const bulk = line.model.trackingType === "bulk";
      for (const out of line.checks.filter((c) => c.phase === "out")) {
        const back = line.checks.filter((c) => c.phase === "in" && (c.outCheckId ? c.outCheckId === out.id : c.itemId === out.itemId)).reduce((s, c) => s + c.quantity, 0);
        const remaining = out.quantity - back;
        if (remaining <= 0) continue;
        await packingChecks.checkIn(actor, { outCheckId: out.id, outcome: "missing", quantity: bulk ? remaining : undefined, note: "Not returned at check-in" });
        autoMissing += remaining;
      }
    }
    const updated = await prisma.packingList.update({ where: { id: listId }, data: { status: "checked_in", checkedInAt: new Date() } });
    await logActivity(actor, { entityType: "project", entityId: list.projectId, action: "checked_in", summary: `Checked in "${list.name}"${autoMissing ? ` (${autoMissing} missing)` : ""}` });
    await emitEvent("packing.checked_in", { listId, projectId: list.projectId, project: list.project.name, missing: autoMissing, by: actor.name });
    return updated;
  },
};

/* ------------------------------------------------------------------------ */
/* Lines                                                                    */
/* ------------------------------------------------------------------------ */

async function assertDraft(listId: string) {
  const list = await loadList(listId);
  if (!canEditLines(list.status as PackingStatus)) throw new PackingError("Lines can only change while the list is a draft.");
  return list;
}

export const packingLines = {
  /**
   * Add a model line; merges into an existing plain line of the same model.
   * The quantity on the list can never exceed what exists in the inventory.
   * With `clamp` (templates, copies, reservations) it is cut down to what is
   * owned instead of failing; returns null when nothing could be added.
   */
  async add(actor: Actor, listId: string, input: LineInput, opts: { clamp?: boolean } = {}) {
    assertCan(actor, "packing.write");
    const list = await assertDraft(listId);
    const model = await prisma.model.findUnique({ where: { id: input.modelId } });
    if (!model) throw new PackingError("Model not found.", "modelId");
    const existing = await prisma.packingLine.findFirst({ where: { listId, modelId: input.modelId, itemId: null, caseItemId: input.caseItemId ?? null } });
    const { owned } = await modelStock(model.id);
    const already = await prisma.packingLine.aggregate({ where: { listId, modelId: model.id, itemId: null }, _sum: { quantity: true } });
    const room = owned - (already._sum.quantity ?? 0);
    let quantity = input.quantity;
    if (quantity > room) {
      if (!opts.clamp) throw new PackingError(`Only ${owned} ${modelLabel(model)} exist in the inventory${room < owned ? ` (${owned - room} already on this list)` : ""}.`, "quantity");
      quantity = Math.max(0, room);
      if (quantity === 0) return null;
    }
    const line = existing
      ? await prisma.packingLine.update({ where: { id: existing.id }, data: { quantity: existing.quantity + quantity, note: input.note ?? existing.note }, include: { model: true } })
      : await prisma.packingLine.create({
          data: { listId, modelId: input.modelId, quantity, note: input.note ?? null, caseItemId: input.caseItemId ?? null, sortOrder: await nextSort(listId) },
          include: { model: true },
        });
    await logActivity(actor, { entityType: "project", entityId: list.projectId, action: "packing_line_added", summary: `${list.name}: added ${lineLabel({ quantity, model })}` });
    return line;
  },

  /** Add a kit (serialized item with contents) as one line; its contents travel with it. */
  async addKit(actor: Actor, listId: string, kitItemId: string) {
    assertCan(actor, "packing.write");
    const list = await assertDraft(listId);
    const kit = await prisma.item.findUnique({ where: { id: kitItemId }, include: { model: true } });
    if (!kit || !kit.isKit) throw new PackingError("That is not a kit.");
    const dup = await prisma.packingLine.findFirst({ where: { listId, itemId: kitItemId } });
    if (dup) throw new PackingError(`${kit.name ?? kit.assetTag} is already on this list.`);
    const line = await prisma.packingLine.create({
      data: { listId, modelId: kit.modelId, quantity: 1, itemId: kit.id, caseItemId: kit.id, note: kit.name, sortOrder: await nextSort(listId) },
      include: { model: true },
    });
    await logActivity(actor, { entityType: "project", entityId: list.projectId, action: "packing_line_added", summary: `${list.name}: added kit ${kit.name ?? kit.assetTag}` });
    return line;
  },

  async update(actor: Actor, lineId: string, input: LineUpdateInput) {
    assertCan(actor, "packing.write");
    const line = await prisma.packingLine.findUniqueOrThrow({ where: { id: lineId }, include: { model: true } });
    const list = await assertDraft(line.listId);
    if (input.itemId) {
      const unit = await prisma.item.findUnique({ where: { id: input.itemId } });
      if (!unit || unit.modelId !== line.modelId) throw new PackingError("Choose a unit of the same model.", "itemId");
    }
    if (!line.itemId) {
      const { owned } = await modelStock(line.modelId);
      const others = await prisma.packingLine.aggregate({ where: { listId: line.listId, modelId: line.modelId, itemId: null, id: { not: line.id } }, _sum: { quantity: true } });
      const room = owned - (others._sum.quantity ?? 0);
      if (input.quantity > room) throw new PackingError(`Only ${owned} ${modelLabel(line.model)} exist in the inventory${room < owned ? ` (${owned - room} on other lines)` : ""}.`, "quantity");
    }
    const updated = await prisma.packingLine.update({
      where: { id: lineId },
      data: { quantity: line.itemId ? 1 : input.quantity, note: input.note ?? null, caseItemId: input.caseItemId ?? null, itemId: input.itemId ?? line.itemId ?? null },
    });
    await logActivity(actor, { entityType: "project", entityId: list.projectId, action: "packing_line_updated", summary: `${list.name}: updated ${lineLabel({ quantity: updated.quantity, model: line.model })}` });
    return updated;
  },

  async remove(actor: Actor, lineId: string) {
    assertCan(actor, "packing.write");
    const line = await prisma.packingLine.findUniqueOrThrow({ where: { id: lineId }, include: { model: true } });
    const list = await assertDraft(line.listId);
    await prisma.packingLine.delete({ where: { id: lineId } });
    await logActivity(actor, { entityType: "project", entityId: list.projectId, action: "packing_line_removed", summary: `${list.name}: removed ${lineLabel(line)}` });
  },

  async addFromReservations(actor: Actor, listId: string) {
    const list = await assertDraft(listId);
    const allocs = await prisma.allocation.findMany({ where: { projectId: list.projectId } });
    for (const a of allocs) await packingLines.add(actor, listId, { modelId: a.modelId, quantity: a.quantity, note: undefined, caseItemId: undefined }, { clamp: true });
    return allocs.length;
  },

  async applyTemplate(actor: Actor, listId: string, templateId: string) {
    await assertDraft(listId);
    const t = await prisma.packingTemplate.findUnique({ where: { id: templateId }, include: { lines: true } });
    if (!t) throw new PackingError("Template not found.");
    for (const l of t.lines) await packingLines.add(actor, listId, { modelId: l.modelId, quantity: l.quantity, note: l.note ?? undefined, caseItemId: undefined }, { clamp: true });
    return t.lines.length;
  },

  async copyFrom(actor: Actor, listId: string, otherListId: string) {
    await assertDraft(listId);
    const lines = await prisma.packingLine.findMany({ where: { listId: otherListId } });
    for (const l of lines) {
      if (l.itemId) await packingLines.addKit(actor, listId, l.itemId).catch(() => {});
      else await packingLines.add(actor, listId, { modelId: l.modelId, quantity: l.quantity, note: l.note ?? undefined, caseItemId: undefined }, { clamp: true });
    }
    return lines.length;
  },
};

async function nextSort(listId: string) {
  const last = await prisma.packingLine.findFirst({ where: { listId }, orderBy: { sortOrder: "desc" } });
  return (last?.sortOrder ?? 0) + 1;
}

/* ------------------------------------------------------------------------ */
/* Packing (ticks) and check-in                                             */
/* ------------------------------------------------------------------------ */

export const packingChecks = {
  /** Tick a unit (serialized) or a quantity (bulk) as packed. */
  async tick(actor: Actor, input: TickInput) {
    assertCan(actor, "packing.write");
    const line = await prisma.packingLine.findUniqueOrThrow({ where: { id: input.lineId }, include: { model: true, checks: true, list: true } });
    if (!canPack(line.list.status as PackingStatus)) throw new PackingError("This list is no longer being packed.");
    const bulk = line.model.trackingType === "bulk";
    const progress = lineProgress({ quantity: line.quantity, trackingType: bulk ? "bulk" : "serialized", checks: line.checks.map((c) => ({ phase: c.phase as "out" | "in", quantity: c.quantity, outcome: c.outcome })) });

    if (bulk) {
      const qty = Math.min(input.quantity ?? progress.toPack, progress.toPack);
      if (qty <= 0) throw new PackingError("This line is fully packed.");
      const source =
        (input.itemId ? await prisma.item.findUnique({ where: { id: input.itemId } }) : null) ??
        (await prisma.item.findFirst({ where: { modelId: line.modelId, status: "in_house", parentItemId: null }, orderBy: { quantity: "desc" } }));
      if (source && source.modelId !== line.modelId) throw new PackingError("That bin holds a different model.", "itemId");
      if (source && source.quantity < qty) throw new PackingError(`Only ${source.quantity} left in ${source.assetTag}.`, "quantity");
      return prisma.packingCheck.create({ data: { lineId: line.id, phase: "out", sourceItemId: source?.id ?? null, quantity: qty, checkedById: actor.id } });
    }

    const itemId = input.itemId ?? line.itemId;
    if (!itemId) throw new PackingError("Scan or choose the unit that goes in.", "itemId");
    if (progress.toPack <= 0) throw new PackingError("This line is fully packed.");
    const unit = await prisma.item.findUnique({ where: { id: itemId } });
    if (!unit) throw new PackingError("Unit not found.", "itemId");
    if (unit.modelId !== line.modelId) throw new PackingError(`${unit.assetTag} is a different model than this line.`, "itemId");
    if (unit.status !== "in_house") throw new PackingError(`${unit.assetTag} is ${unit.status.replace("_", " ")}, not in house.`, "itemId");
    const already = await prisma.packingCheck.findFirst({ where: { itemId, phase: "out", line: { listId: line.listId } } });
    if (already) throw new PackingError(`${unit.assetTag} is already packed on this list.`, "itemId");
    return prisma.packingCheck.create({ data: { lineId: line.id, phase: "out", itemId, quantity: 1, checkedById: actor.id } });
  },

  /**
   * "Pack all" on a serialized line: ticks in-house units of the model that
   * are not packed on this list yet, in asset-tag order (the pick list's
   * order), up to what the line still needs. Returns how many were packed
   * and how many are still missing because too few are in house.
   */
  async tickAll(actor: Actor, lineId: string): Promise<{ packed: number; missing: number }> {
    assertCan(actor, "packing.write");
    return prisma.$transaction(async (tx) => {
      const line = await tx.packingLine.findUniqueOrThrow({ where: { id: lineId }, include: { model: true, checks: true, list: true } });
      if (!canPack(line.list.status as PackingStatus)) throw new PackingError("This list is no longer being packed.");
      if (line.model.trackingType === "bulk" || line.itemId) throw new PackingError("Pack all is for lines of several serialized units.");
      const progress = lineProgress({ quantity: line.quantity, trackingType: "serialized", checks: line.checks.map((c) => ({ phase: c.phase as "out" | "in", quantity: c.quantity, outcome: c.outcome })) });
      if (progress.toPack <= 0) throw new PackingError("This line is fully packed.");
      const packedHere = new Set((await tx.packingCheck.findMany({ where: { phase: "out", itemId: { not: null }, line: { listId: line.listId } }, select: { itemId: true } })).map((c) => c.itemId));
      const units = (await tx.item.findMany({ where: { modelId: line.modelId, status: "in_house", parentItemId: null, isKit: false }, orderBy: { assetTag: "asc" }, select: { id: true } }))
        .filter((u) => !packedHere.has(u.id))
        .slice(0, progress.toPack);
      if (units.length === 0) throw new PackingError("No units of this model are in house.");
      await tx.packingCheck.createMany({ data: units.map((u) => ({ lineId: line.id, phase: "out", itemId: u.id, quantity: 1, checkedById: actor.id })) });
      return { packed: units.length, missing: progress.toPack - units.length };
    });
  },

  /** Undo a tick while the list is still a draft. Undoing one that is already gone does nothing (a double tap). */
  async untick(actor: Actor, checkId: string) {
    assertCan(actor, "packing.write");
    const check = await prisma.packingCheck.findUnique({ where: { id: checkId }, include: { line: { include: { list: true } } } });
    if (!check) return;
    if (check.phase !== "out" || !canPack(check.line.list.status as PackingStatus)) throw new PackingError("This cannot be undone any more: the list has been checked out.");
    await prisma.packingCheck.deleteMany({ where: { id: checkId } });
  },

  /**
   * Scan a tag while packing: finds the line it belongs to and ticks it.
   * Returns what happened so the UI can show it.
   */
  async scan(actor: Actor, listId: string, tag: string) {
    assertCan(actor, "packing.write");
    const normalised = normaliseAssetTag(tag);
    const item = normalised ? await prisma.item.findFirst({ where: { assetTag: { equals: normalised, mode: "insensitive" } }, include: { model: true } }) : null;
    if (!item) return { status: "unknown" as const, tag };
    const lines = await prisma.packingLine.findMany({ where: { listId }, include: { model: true, checks: true } });
    const bulk = item.model.trackingType === "bulk";
    const candidates = lines.filter((l) => l.modelId === item.modelId && (!l.itemId || l.itemId === item.id));
    const open = candidates.find((l) => lineProgress({ quantity: l.quantity, trackingType: bulk ? "bulk" : "serialized", checks: l.checks.map((c) => ({ phase: c.phase as "out" | "in", quantity: c.quantity, outcome: c.outcome })) }).toPack > 0);
    if (!open) return { status: "not_on_list" as const, tag: item.assetTag, modelId: item.modelId, modelLabel: `${modelLabel(item.model)}`, alreadyComplete: candidates.length > 0 };
    try {
      const check = await packingChecks.tick(actor, { lineId: open.id, itemId: item.id, quantity: undefined });
      return { status: "ticked" as const, tag: item.assetTag, lineId: open.id, checkId: check.id, quantity: check.quantity, modelLabel: `${modelLabel(item.model)}` };
    } catch (err) {
      return { status: "error" as const, tag: item.assetTag, message: err instanceof Error ? err.message : String(err) };
    }
  },

  /** Record a unit (or a bulk quantity) coming back with an outcome. */
  async checkIn(actor: Actor, input: CheckInInput) {
    assertCan(actor, "packing.write");
    const out = await prisma.packingCheck.findUniqueOrThrow({ where: { id: input.outCheckId }, include: { line: { include: { model: true, list: { include: { project: true } }, checks: true } }, item: true } });
    if (out.phase !== "out") throw new PackingError("Not an out-check.");
    if (!canCheckIn(out.line.list.status as PackingStatus)) throw new PackingError("This list is not checked out.");
    const outcome = input.outcome as CheckOutcome;
    const bulk = out.line.model.trackingType === "bulk";
    const back = out.line.checks.filter((c) => c.phase === "in" && (c.outCheckId ? c.outCheckId === out.id : c.itemId === out.itemId)).reduce((s, c) => s + c.quantity, 0);
    const remaining = out.quantity - back;
    if (remaining <= 0) throw new PackingError("Already fully checked in.");
    const qty = bulk ? Math.min(input.quantity ?? remaining, remaining) : 1;
    const project = out.line.list.project;
    const targetStatus = outcomeItemStatus(outcome);
    const reason = `${outcome === "ok" ? "Returned from" : outcome === "damaged" ? "Damaged on" : "Missing after"} ${project.name}${input.note ? `: ${input.note}` : ""}`;
    let resultItemId: string | null = out.itemId;
    // Set when a full return merges the travel bin into its source and deletes it: the in-check cannot point at it then.
    let travelGone = false;

    if (outcome === "used") {
      // A consumable used up on the show: the quantity leaves the travel bin and the stock for good,
      // and the ledger row (linked to this check-in) says where it went.
      if (!out.line.model.consumable || !bulk) throw new PackingError("Only consumables can be checked in as used.");
      return prisma.$transaction(async (tx) => {
        if (out.item) {
          const travel = await tx.item.findUniqueOrThrow({ where: { id: out.item.id } });
          const left = travel.quantity - qty;
          if (left <= 0) {
            await tx.item.delete({ where: { id: travel.id } });
            travelGone = true;
          } else await tx.item.update({ where: { id: travel.id }, data: { quantity: left } });
        }
        const row = await tx.packingCheck.create({
          data: { lineId: out.lineId, phase: "in", itemId: travelGone ? null : out.itemId, sourceItemId: out.sourceItemId, outCheckId: out.id, resultItemId: null, quantity: qty, outcome, note: input.note ?? null, checkedById: actor.id },
        });
        await tx.stockMovement.create({ data: { modelId: out.line.modelId, quantity: -qty, kind: "used", projectId: project.id, note: input.note ?? null, userId: actor.id || null, packingCheckId: row.id } });
        await logActivity(actor, { entityType: "project", entityId: project.id, action: "checked_in_unit", summary: `${out.line.list.name}: ${qty}× ${modelLabel(out.line.model)} used` }, tx);
        await logActivity(actor, { entityType: "model", entityId: out.line.modelId, action: "consumable_used", summary: `Used ${qty} of ${modelLabel(out.line.model)} on ${project.name}` }, tx);
        return row;
      });
    }

    if (out.item) {
      if (bulk) {
        await prisma.$transaction(async (tx) => {
          const travel = await tx.item.findUniqueOrThrow({ where: { id: out.item!.id } });
          const source = out.sourceItemId ? await tx.item.findUnique({ where: { id: out.sourceItemId } }) : null;
          const left = travel.quantity - qty;
          if (outcome === "ok" && source) {
            await tx.item.update({ where: { id: source.id }, data: { quantity: source.quantity + qty } });
            if (left <= 0) {
              await tx.item.delete({ where: { id: travel.id } });
              travelGone = true;
            }
            else await tx.item.update({ where: { id: travel.id }, data: { quantity: left } });
            resultItemId = source.id;
          } else if (outcome === "ok") {
            // No source bin any more: the travel bin becomes a normal bin at home.
            await tx.item.update({ where: { id: travel.id }, data: { quantity: travel.quantity, status: "in_house", locationId: travel.homeLocationId ?? null } });
            resultItemId = travel.id;
          } else {
            // Damaged / missing quantity stays on its own bin with that status.
            if (left > 0) {
              await tx.item.update({ where: { id: travel.id }, data: { quantity: left } });
              const split = await tx.item.create({
                data: {
                  modelId: travel.modelId,
                  assetTag: await nextAssetTag(tx),
                  quantity: qty,
                  status: targetStatus,
                  locationId: outcome === "missing" ? travel.locationId : travel.homeLocationId,
                  homeLocationId: travel.homeLocationId,
                  notes: `${outcome} from ${project.name}`,
                  statusLogs: { create: { fromStatus: "on_project", toStatus: targetStatus, reason, userId: actor.id } },
                },
              });
              resultItemId = split.id;
            } else {
              await tx.item.update({ where: { id: travel.id }, data: { status: targetStatus, locationId: outcome === "missing" ? travel.locationId : travel.homeLocationId } });
              await tx.statusLog.create({ data: { itemId: travel.id, fromStatus: "on_project", toStatus: targetStatus, reason, userId: actor.id } });
              resultItemId = travel.id;
            }
          }
        });
      } else {
        const locationId = outcome === "missing" ? out.item.locationId : out.item.homeLocationId;
        if (out.item.status !== targetStatus) {
          await inventoryItems.changeStatus(actor, out.item.id, { status: targetStatus, reason, locationId: locationId ?? null }, { viaFlow: true });
        }
      }
    }
    const row = await prisma.packingCheck.create({
      data: { lineId: out.lineId, phase: "in", itemId: travelGone ? null : out.itemId, sourceItemId: out.sourceItemId, outCheckId: out.id, resultItemId, quantity: qty, outcome, note: input.note ?? null, checkedById: actor.id },
    });
    await logActivity(actor, {
      entityType: "project",
      entityId: project.id,
      action: "checked_in_unit",
      summary: `${out.line.list.name}: ${qty}× ${modelLabel(out.line.model)}${out.item ? ` (${out.item.assetTag})` : ""} ${outcome}`,
    });
    return row;
  },
};

/**
 * Undo a recorded return while the list is still checked out: the unit (or
 * bulk quantity) goes back out to the project and the in-check disappears.
 * Reverses exactly what checkIn did, using the ids it recorded.
 */
export async function undoCheckIn(actor: Actor, inCheckId: string) {
  assertCan(actor, "packing.write");
  const row = await prisma.packingCheck.findUniqueOrThrow({ where: { id: inCheckId }, include: { line: { include: { model: true, list: { include: { project: true } } } } } });
  if (row.phase !== "in") throw new PackingError("Not a check-in.");
  if (!canCheckIn(row.line.list.status as PackingStatus)) throw new PackingError("The check-in is finished. Change the item's status by hand instead.");
  const project = row.line.list.project;
  const locationId = await projectLocationId(project.id);
  const reason = `Check-in undone: ${project.name}`;
  const bulk = row.line.model.trackingType === "bulk";

  if (!bulk) {
    if (row.itemId) {
      const item = await prisma.item.findUnique({ where: { id: row.itemId } });
      if (item && item.status !== "on_project") await inventoryItems.changeStatus(actor, item.id, { status: "on_project", reason, locationId }, { viaFlow: true });
    }
  } else {
    const out = row.outCheckId ? await prisma.packingCheck.findUnique({ where: { id: row.outCheckId } }) : await prisma.packingCheck.findFirst({ where: { lineId: row.lineId, phase: "out", sourceItemId: row.sourceItemId } });
    const qty = row.quantity;
    await prisma.$transaction(async (tx) => {
      let travel = out?.itemId ? await tx.item.findUnique({ where: { id: out.itemId } }) : null;
      const source = row.sourceItemId ? await tx.item.findUnique({ where: { id: row.sourceItemId } }) : null;
      const addBack = async (n: number) => {
        if (travel) {
          travel = await tx.item.update({ where: { id: travel.id }, data: { quantity: travel.quantity + n, status: "on_project", locationId } });
        } else {
          travel = await tx.item.create({
            data: {
              modelId: row.line.modelId,
              assetTag: await nextAssetTag(tx),
              quantity: n,
              status: "on_project",
              locationId,
              homeLocationId: source?.homeLocationId ?? source?.locationId ?? null,
              notes: `Travel bin (${project.name})`,
              statusLogs: { create: { fromStatus: null, toStatus: "on_project", reason, userId: actor.id } },
            },
          });
          if (out) await tx.packingCheck.update({ where: { id: out.id }, data: { itemId: travel.id } });
        }
      };
      if (row.outcome === "used") {
        // Used up on the show: the ledger row goes, the quantity goes back into the travel bin.
        await tx.stockMovement.deleteMany({ where: { packingCheckId: row.id } });
        await addBack(qty);
      } else if (row.outcome === "ok") {
        if (source && row.resultItemId === source.id) {
          // Merged into the source bin: take it out again.
          await tx.item.update({ where: { id: source.id }, data: { quantity: Math.max(0, source.quantity - qty) } });
          await addBack(qty);
        } else if (travel) {
          // Travel bin had become a home bin: send it back out.
          await tx.item.update({ where: { id: travel.id }, data: { status: "on_project", locationId } });
        }
      } else if (row.resultItemId && row.resultItemId !== travel?.id) {
        // Damaged / missing quantity was split off: remove that bin, put the quantity back.
        const split = await tx.item.findUnique({ where: { id: row.resultItemId } });
        if (split) await tx.item.delete({ where: { id: split.id } });
        await addBack(qty);
      } else if (travel) {
        // The whole travel bin had the outcome status: back out it goes.
        await tx.item.update({ where: { id: travel.id }, data: { status: "on_project", locationId } });
        await tx.statusLog.create({ data: { itemId: travel.id, fromStatus: travel.status, toStatus: "on_project", reason, userId: actor.id } });
      }
    });
  }
  await prisma.packingCheck.delete({ where: { id: inCheckId } });
  await logActivity(actor, { entityType: "project", entityId: project.id, action: "check_in_undone", summary: `${row.line.list.name}: undid ${row.outcome} return of ${row.quantity}× ${modelLabel(row.line.model)}` });
}

/* ------------------------------------------------------------------------ */
/* Templates                                                                */
/* ------------------------------------------------------------------------ */

export const packingTemplates = {
  async create(actor: Actor, input: TemplateInput) {
    assertCan(actor, "packing.write");
    const t = await prisma.packingTemplate.create({ data: { name: input.name, description: input.description ?? null } });
    await logActivity(actor, { entityType: "settings", entityId: t.id, action: "packing_template_created", summary: `Created packing template "${t.name}"` });
    return t;
  },
  async update(actor: Actor, id: string, input: TemplateInput) {
    assertCan(actor, "packing.write");
    return prisma.packingTemplate.update({ where: { id }, data: { name: input.name, description: input.description ?? null } });
  },
  async remove(actor: Actor, id: string) {
    assertCan(actor, "packing.write");
    const t = await prisma.packingTemplate.delete({ where: { id } });
    await logActivity(actor, { entityType: "settings", entityId: id, action: "packing_template_deleted", summary: `Deleted packing template "${t.name}"` });
  },
  async addLine(actor: Actor, templateId: string, input: TemplateLineInput) {
    assertCan(actor, "packing.write");
    const existing = await prisma.packingTemplateLine.findFirst({ where: { templateId, modelId: input.modelId } });
    if (existing) return prisma.packingTemplateLine.update({ where: { id: existing.id }, data: { quantity: existing.quantity + input.quantity } });
    const last = await prisma.packingTemplateLine.findFirst({ where: { templateId }, orderBy: { sortOrder: "desc" } });
    return prisma.packingTemplateLine.create({ data: { templateId, modelId: input.modelId, quantity: input.quantity, note: input.note ?? null, sortOrder: (last?.sortOrder ?? 0) + 1 } });
  },
  async removeLine(actor: Actor, lineId: string) {
    assertCan(actor, "packing.write");
    await prisma.packingTemplateLine.delete({ where: { id: lineId } });
  },
  /** Save a packing list's plain lines as a reusable template. */
  async createFromList(actor: Actor, listId: string, name: string) {
    assertCan(actor, "packing.write");
    const lines = await prisma.packingLine.findMany({ where: { listId, itemId: null }, orderBy: { sortOrder: "asc" } });
    const t = await prisma.packingTemplate.create({
      data: { name, lines: { create: lines.map((l, i) => ({ modelId: l.modelId, quantity: l.quantity, note: l.note, sortOrder: i })) } },
    });
    await logActivity(actor, { entityType: "settings", entityId: t.id, action: "packing_template_created", summary: `Saved packing template "${t.name}" from a list` });
    return t;
  },
};

/* ------------------------------------------------------------------------ */
/* Share links                                                              */
/* ------------------------------------------------------------------------ */

export const shareLinks = {
  async ensure(actor: Actor, targetType: "packing_list" | "plan", targetId: string) {
    assertCan(actor, "share.create");
    const existing = await prisma.shareLink.findFirst({ where: { targetType, targetId } });
    if (existing) return existing;
    return prisma.shareLink.create({ data: { targetType, targetId, token: randomBytes(18).toString("base64url"), createdById: actor.id } });
  },
  async revoke(actor: Actor, targetType: "packing_list" | "plan", targetId: string) {
    assertCan(actor, "share.create");
    await prisma.shareLink.deleteMany({ where: { targetType, targetId } });
  },
  async resolve(token: string) {
    const link = await prisma.shareLink.findUnique({ where: { token } });
    if (!link || (link.expiresAt && link.expiresAt < new Date())) return null;
    return link;
  },
  async current(targetType: "packing_list" | "plan", targetId: string) {
    return prisma.shareLink.findFirst({ where: { targetType, targetId } });
  },
};
