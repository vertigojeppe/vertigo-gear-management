import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { normaliseAssetTag } from "@/lib/asset-tag";
import { modelLabel } from "@/lib/format";
import { formatQty, isLow, isMetres, roundQty } from "./consumables-logic";
import type { ConsumableCountInput, ConsumableReceiveInput, ConsumableUseInput, PartFitInput } from "./schema";

export class ConsumableError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ConsumableError";
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Db = typeof prisma | Tx;
const num = (v: { toNumber(): number } | null | undefined): number => (v ? v.toNumber() : 0);

/**
 * Stock on the shelf of consumable models, by id. Metres: the ledger sum.
 * Pieces: what sits in house in the model's bins (the ledger only keeps
 * their history).
 */
export async function stockByModel(models: { id: string; unit: string }[], db: Db = prisma): Promise<Map<string, number>> {
  const metreIds = models.filter((m) => isMetres(m.unit)).map((m) => m.id);
  const pieceIds = models.filter((m) => !isMetres(m.unit)).map((m) => m.id);
  const [ledger, bins] = await Promise.all([
    metreIds.length ? db.stockMovement.groupBy({ by: ["modelId"], where: { modelId: { in: metreIds } }, _sum: { quantity: true } }) : [],
    pieceIds.length ? db.item.groupBy({ by: ["modelId"], where: { modelId: { in: pieceIds }, status: "in_house" }, _sum: { quantity: true } }) : [],
  ]);
  const out = new Map<string, number>();
  for (const m of models) out.set(m.id, 0);
  for (const r of ledger) out.set(r.modelId, roundQty(num(r._sum.quantity), "m"));
  for (const r of bins) out.set(r.modelId, r._sum.quantity ?? 0);
  return out;
}

async function consumableModel(db: Db, modelId: string) {
  const m = await db.model.findUnique({ where: { id: modelId } });
  if (!m) throw new ConsumableError("Model not found.");
  if (!m.consumable) throw new ConsumableError("This model is not a consumable.");
  return m;
}

/**
 * Consumables: lamps, LED strip, alu profile. Using one takes it off the
 * shelf for good and writes a ledger row that says where it went (a unit,
 * a project). Metre consumables are received and counted through the
 * ledger; piece consumables are added as bins like any bulk model.
 */
export const consumables = {
  async use(actor: Actor, input: ConsumableUseInput) {
    assertCan(actor, "inventory.write");
    return prisma.$transaction(async (tx) => {
      const m = await consumableModel(tx, input.modelId);
      const qty = roundQty(input.quantity, m.unit);
      if (qty <= 0) throw new ConsumableError(isMetres(m.unit) ? "Enter how many metres were used." : "Enter how many were used (whole pieces).", "quantity");

      let item: { id: string; assetTag: string } | null = null;
      if (input.itemTag) {
        const tag = normaliseAssetTag(input.itemTag);
        item = tag ? await tx.item.findFirst({ where: { assetTag: { equals: tag, mode: "insensitive" } }, select: { id: true, assetTag: true } }) : null;
        if (!item) throw new ConsumableError(`No unit with the tag ${input.itemTag}.`, "itemTag");
      }
      const project = input.projectId ? await tx.project.findUnique({ where: { id: input.projectId }, select: { id: true, name: true } }) : null;

      if (isMetres(m.unit)) {
        const stock = (await stockByModel([m], tx)).get(m.id) ?? 0;
        if (qty > stock + 0.001) throw new ConsumableError(`Only ${formatQty(stock, m.unit)} in stock. Receive more or count the stock first.`, "quantity");
      } else {
        // Take from the fullest bins first; a bin can go down to zero and stays as the shelf's place.
        const bins = await tx.item.findMany({ where: { modelId: m.id, status: "in_house", quantity: { gt: 0 } }, orderBy: [{ quantity: "desc" }, { assetTag: "asc" }] });
        const total = bins.reduce((s, b) => s + b.quantity, 0);
        if (qty > total) throw new ConsumableError(`Only ${total} in house.`, "quantity");
        let left = qty;
        for (const b of bins) {
          if (left === 0) break;
          const take = Math.min(left, b.quantity);
          await tx.item.update({ where: { id: b.id }, data: { quantity: b.quantity - take } });
          await logActivity(actor, { entityType: "item", entityId: b.id, action: "consumed", summary: `${take} taken from ${b.assetTag} (${modelLabel(m)})` }, tx);
          left -= take;
        }
      }

      const movement = await tx.stockMovement.create({
        data: { modelId: m.id, quantity: -qty, kind: "used", itemId: item?.id ?? null, projectId: project?.id ?? null, note: input.note ?? null, userId: actor.id || null },
      });
      const where = [item ? `in ${item.assetTag}` : null, project ? `on ${project.name}` : null].filter(Boolean).join(" ");
      await logActivity(actor, { entityType: "model", entityId: m.id, action: "consumable_used", summary: `Used ${formatQty(qty, m.unit)} of ${modelLabel(m)}${where ? ` ${where}` : ""}`, details: { movementId: movement.id } }, tx);
      if (item) await logActivity(actor, { entityType: "item", entityId: item.id, action: "part_used", summary: `Part used: ${formatQty(qty, m.unit)} ${modelLabel(m)}${project ? ` (${project.name})` : ""}`, details: { movementId: movement.id } }, tx);
      return movement;
    });
  },

  /** Metres bought or cut off a delivery. Pieces come in as bins instead. */
  async receive(actor: Actor, input: ConsumableReceiveInput) {
    assertCan(actor, "inventory.write");
    const m = await consumableModel(prisma, input.modelId);
    if (!isMetres(m.unit)) throw new ConsumableError("Pieces are added as items (a bin with a quantity), not received here.");
    const qty = roundQty(input.quantity, m.unit);
    const movement = await prisma.stockMovement.create({ data: { modelId: m.id, quantity: qty, kind: "received", note: input.note ?? null, userId: actor.id || null } });
    await logActivity(actor, { entityType: "model", entityId: m.id, action: "consumable_received", summary: `Received ${formatQty(qty, m.unit)} of ${modelLabel(m)}`, details: { movementId: movement.id } });
    return movement;
  },

  /** Stocktake for metres: set what is really on the shelf; the difference is written as a "count" row. */
  async count(actor: Actor, input: ConsumableCountInput) {
    assertCan(actor, "inventory.write");
    const m = await consumableModel(prisma, input.modelId);
    if (!isMetres(m.unit)) throw new ConsumableError("Correct a piece count by editing the bin's quantity.");
    const counted = roundQty(input.quantity, m.unit);
    const stock = (await stockByModel([m])).get(m.id) ?? 0;
    const delta = roundQty(counted - stock, m.unit);
    if (delta === 0) return null;
    const movement = await prisma.stockMovement.create({ data: { modelId: m.id, quantity: delta, kind: "count", note: input.note ?? null, userId: actor.id || null } });
    await logActivity(actor, { entityType: "model", entityId: m.id, action: "consumable_counted", summary: `Counted ${formatQty(counted, m.unit)} of ${modelLabel(m)} (was ${formatQty(stock, m.unit)})`, details: { movementId: movement.id } });
    return movement;
  },
};

/** "This part fits that model", with the packing list's spare rule. */
export const partFits = {
  async add(actor: Actor, partId: string, input: PartFitInput) {
    assertCan(actor, "inventory.write");
    if (partId === input.modelId) throw new ConsumableError("A part cannot fit itself.", "modelId");
    const [part, model] = await Promise.all([prisma.model.findUnique({ where: { id: partId } }), prisma.model.findUnique({ where: { id: input.modelId } })]);
    if (!part?.consumable) throw new ConsumableError("Only consumables can be spare parts.");
    if (!model) throw new ConsumableError("Choose the model it fits.", "modelId");
    const fit = await prisma.partFit.upsert({
      where: { partId_modelId: { partId, modelId: input.modelId } },
      create: { partId, modelId: input.modelId, perUnits: input.perUnits, minQty: input.minQty },
      update: { perUnits: input.perUnits, minQty: input.minQty },
    });
    await logActivity(actor, { entityType: "model", entityId: partId, action: "part_fit_set", summary: `${modelLabel(part)} fits ${modelLabel(model)} (1 per ${input.perUnits}, at least ${input.minQty})` });
    return fit;
  },

  async remove(actor: Actor, id: string) {
    assertCan(actor, "inventory.write");
    const fit = await prisma.partFit.delete({ where: { id }, include: { part: true, model: true } });
    await logActivity(actor, { entityType: "model", entityId: fit.partId, action: "part_fit_removed", summary: `${modelLabel(fit.part)} no longer listed for ${modelLabel(fit.model)}` });
  },
};

/* Queries ------------------------------------------------------------------- */

export type MovementRow = { id: string; kind: string; quantity: number; itemId: string | null; itemTag: string | null; projectId: string | null; projectName: string | null; userName: string | null; note: string | null; createdAt: Date };

/** Everything the consumable section of a model page needs. */
export async function consumableDetail(modelId: string) {
  const m = await prisma.model.findUnique({ where: { id: modelId } });
  if (!m?.consumable) return null;
  const [stock, movements, fits] = await Promise.all([
    stockByModel([m]).then((s) => s.get(m.id) ?? 0),
    prisma.stockMovement.findMany({ where: { modelId }, orderBy: { createdAt: "desc" }, take: 30, include: { item: { select: { assetTag: true } }, project: { select: { name: true } }, user: { select: { name: true } } } }),
    prisma.partFit.findMany({ where: { partId: modelId }, include: { model: { select: { id: true, manufacturer: true, name: true, variant: true } } } }),
  ]);
  const minStock = m.minStock ? m.minStock.toNumber() : null;
  return {
    unit: m.unit,
    stock,
    minStock,
    low: isLow(stock, minStock),
    movements: movements.map(
      (r): MovementRow => ({ id: r.id, kind: r.kind, quantity: roundQty(r.quantity.toNumber(), m.unit), itemId: r.itemId, itemTag: r.item?.assetTag ?? null, projectId: r.projectId, projectName: r.project?.name ?? null, userName: r.user?.name ?? null, note: r.note, createdAt: r.createdAt }),
    ),
    fits: fits.map((f) => ({ id: f.id, modelId: f.modelId, label: modelLabel(f.model), perUnits: f.perUnits, minQty: f.minQty })).sort((a, b) => a.label.localeCompare(b.label)),
  };
}

/** The spare parts that fit a model, with their stock (for the model page). */
export async function sparePartsFor(modelId: string) {
  const fits = await prisma.partFit.findMany({ where: { modelId }, include: { part: true } });
  const stock = await stockByModel(fits.map((f) => f.part));
  return fits
    .map((f) => {
      const s = stock.get(f.partId) ?? 0;
      const min = f.part.minStock ? f.part.minStock.toNumber() : null;
      return { fitId: f.id, partId: f.partId, label: modelLabel(f.part), unit: f.part.unit, stock: s, low: isLow(s, min), perUnits: f.perUnits, minQty: f.minQty };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export type LowStockRow = { modelId: string; label: string; manufacturer: string; name: string; variant: string | null; categoryId: string; unit: string; stock: number; minStock: number; onWishList: boolean };

/** Consumables below their minimum, lowest first relative to the minimum (for the dashboard). */
export async function lowStock(): Promise<LowStockRow[]> {
  const models = await prisma.model.findMany({ where: { consumable: true, archived: false, minStock: { not: null } } });
  if (models.length === 0) return [];
  const [stock, wishes] = await Promise.all([stockByModel(models), prisma.wishItem.findMany({ where: { status: "open" }, select: { manufacturer: true, name: true, variant: true } })]);
  const wishKey = (x: { manufacturer: string; name: string; variant: string | null }) => `${x.manufacturer}|${x.name}|${x.variant ?? ""}`.toLowerCase();
  const wished = new Set(wishes.map(wishKey));
  return models
    .map((m) => ({ m, s: stock.get(m.id) ?? 0, min: m.minStock!.toNumber() }))
    .filter((x) => isLow(x.s, x.min))
    .sort((a, b) => a.s / (a.min || 1) - b.s / (b.min || 1))
    .map(({ m, s, min }) => ({ modelId: m.id, label: modelLabel(m), manufacturer: m.manufacturer, name: m.name, variant: m.variant, categoryId: m.categoryId, unit: m.unit, stock: s, minStock: min, onWishList: wished.has(wishKey(m)) }));
}
