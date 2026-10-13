import { prisma, type Db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { dateFromString } from "@/lib/dates";
import { modelLabel } from "@/lib/format";
import { netFrom, type PurchaseInput } from "./schema";

export class PurchaseError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "PurchaseError";
  }
}

function data(input: PurchaseInput) {
  return {
    modelId: input.modelId,
    supplierContactId: input.supplierContactId ?? null,
    date: input.date ? dateFromString(input.date) : null,
    reference: input.reference ?? null,
    quantity: input.quantity,
    listPrice: input.listPrice ?? null,
    discountPct: input.discountPct ?? null,
    netPrice: netFrom(input.listPrice, input.discountPct, input.netPrice),
    notes: input.notes ?? null,
  };
}

type Tx = Db | Parameters<Parameters<Db["$transaction"]>[0]>[0];

/**
 * Purchase records: what a model cost, per quote / order / invoice line.
 * Reading them needs `inventory.finance` (the same gate as unit purchase
 * prices); writing needs `inventory.write` as well. Attachments (the
 * quote PDF) hang off the record through the files module.
 */
export const purchases = {
  async get(actor: Actor, id: string) {
    assertCan(actor, "inventory.finance");
    return prisma.purchase.findUnique({
      where: { id },
      include: { model: { select: { id: true, manufacturer: true, name: true, variant: true } }, supplier: { select: { id: true, name: true, organisation: true } }, createdBy: { select: { name: true } } },
    });
  },

  async create(actor: Actor, input: PurchaseInput, tx: Tx = prisma) {
    assertCan(actor, "inventory.write");
    assertCan(actor, "inventory.finance");
    const model = await tx.model.findUnique({ where: { id: input.modelId }, select: { manufacturer: true, name: true, variant: true } });
    if (!model) throw new PurchaseError("That model does not exist.", "modelId");
    const p = await tx.purchase.create({ data: { ...data(input), createdById: actor.id || null } });
    await logActivity(actor, { entityType: "model", entityId: input.modelId, action: "purchase_added", summary: `Purchase record added for ${modelLabel(model)}${p.reference ? ` (${p.reference})` : ""}`, details: { purchaseId: p.id } }, tx);
    return p;
  },

  async update(actor: Actor, id: string, input: PurchaseInput) {
    assertCan(actor, "inventory.write");
    assertCan(actor, "inventory.finance");
    const before = await prisma.purchase.findUnique({ where: { id }, select: { modelId: true } });
    if (!before) throw new PurchaseError("That purchase record does not exist.");
    const p = await prisma.purchase.update({ where: { id }, data: { ...data(input), modelId: before.modelId } });
    await logActivity(actor, { entityType: "model", entityId: p.modelId, action: "purchase_updated", summary: `Purchase record updated${p.reference ? ` (${p.reference})` : ""}`, details: { purchaseId: p.id } });
    return p;
  },

  async remove(actor: Actor, id: string) {
    assertCan(actor, "inventory.write");
    assertCan(actor, "inventory.finance");
    const p = await prisma.purchase.delete({ where: { id } });
    await prisma.attachment.deleteMany({ where: { entityType: "purchase", entityId: id } });
    await logActivity(actor, { entityType: "model", entityId: p.modelId, action: "purchase_removed", summary: `Purchase record removed${p.reference ? ` (${p.reference})` : ""}`, details: { purchaseId: id } });
  },
};
