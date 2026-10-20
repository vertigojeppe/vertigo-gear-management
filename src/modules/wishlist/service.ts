import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { modelLabel } from "@/lib/format";
import type { WishInput, WishStatus } from "./schema";

export class WishError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "WishError";
  }
}

function data(input: WishInput) {
  return {
    manufacturer: input.manufacturer,
    name: input.name,
    variant: input.variant ?? null,
    categoryId: input.categoryId ?? null,
    quantity: input.quantity,
    price: input.price ?? null,
    rentalDayPrice: input.rentalDayPrice ?? null,
    link: input.link ?? null,
    notes: input.notes ?? null,
  };
}

/**
 * Gear we want to buy. A wish has no items and takes no part in
 * availability; it turns into a model through the new-model form
 * (`/inventory/models/new?wish=<id>`), which calls `markBought` with the
 * model it created. "Bought" without a model is for things bought that
 * are not inventory (reference material, consumables).
 */
export const wishes = {
  async get(id: string) {
    return prisma.wishItem.findUnique({ where: { id }, include: { category: { select: { id: true, name: true } }, model: { select: { id: true, manufacturer: true, name: true, variant: true } } } });
  },

  async create(actor: Actor, input: WishInput) {
    assertCan(actor, "inventory.write");
    const w = await prisma.wishItem.create({ data: { ...data(input), createdById: actor.id || null } });
    await logActivity(actor, { entityType: "wish", entityId: w.id, action: "created", summary: `Added ${modelLabel(w)} to the wish list` });
    return w;
  },

  async update(actor: Actor, id: string, input: WishInput) {
    assertCan(actor, "inventory.write");
    const w = await prisma.wishItem.update({ where: { id }, data: data(input) });
    await logActivity(actor, { entityType: "wish", entityId: w.id, action: "updated", summary: `Updated wish ${modelLabel(w)}` });
    return w;
  },

  /** Open ↔ bought by hand (no model). Reopening a converted wish keeps the model link so the history stays visible. */
  async setStatus(actor: Actor, id: string, status: WishStatus) {
    assertCan(actor, "inventory.write");
    const w = await prisma.wishItem.update({ where: { id }, data: { status } });
    await logActivity(actor, { entityType: "wish", entityId: w.id, action: status === "bought" ? "bought" : "reopened", summary: `${status === "bought" ? "Bought" : "Reopened"} wish ${modelLabel(w)}` });
    return w;
  },

  /** Called by the model form after it created the model the wish asked for. */
  async markBought(actor: Actor, id: string, modelId: string, tx: Parameters<typeof logActivity>[2] = prisma) {
    assertCan(actor, "inventory.write");
    const w = await tx.wishItem.update({ where: { id }, data: { status: "bought", modelId } });
    await logActivity(actor, { entityType: "wish", entityId: w.id, action: "converted", summary: `Wish ${modelLabel(w)} became a model` }, tx);
    await logActivity(actor, { entityType: "model", entityId: modelId, action: "created_from_wish", summary: `Created from the wish list`, details: { wishId: id } }, tx);
    return w;
  },

  /** From the dashboard's running-low list: a wish with the model's fields, unless an open one exists already. */
  async fromModel(actor: Actor, modelId: string, quantity: number) {
    assertCan(actor, "inventory.write");
    const m = await prisma.model.findUniqueOrThrow({ where: { id: modelId } });
    const existing = await prisma.wishItem.findFirst({ where: { status: "open", manufacturer: { equals: m.manufacturer, mode: "insensitive" }, name: { equals: m.name, mode: "insensitive" }, variant: m.variant === null ? null : { equals: m.variant, mode: "insensitive" } } });
    if (existing) return existing;
    const w = await prisma.wishItem.create({
      data: { manufacturer: m.manufacturer, name: m.name, variant: m.variant, categoryId: m.categoryId, quantity: Math.max(1, Math.ceil(quantity)), notes: "Running low", createdById: actor.id || null },
    });
    await logActivity(actor, { entityType: "wish", entityId: w.id, action: "created", summary: `Added ${modelLabel(w)} to the wish list (running low)` });
    return w;
  },

  async remove(actor: Actor, id: string) {
    assertCan(actor, "inventory.write");
    const w = await prisma.wishItem.delete({ where: { id } });
    await logActivity(actor, { entityType: "wish", entityId: id, action: "deleted", summary: `Removed wish ${modelLabel(w)}` });
  },
};
