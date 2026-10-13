import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { dateFromString } from "@/lib/dates";
import { modelLabel } from "@/lib/format";
import { parseLinks, type SubHireItemInput, type SubHireLineInput } from "./schema";

export class SubHireError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "SubHireError";
  }
}

function itemData(input: SubHireItemInput) {
  return {
    ownerContactId: input.ownerContactId,
    manufacturer: input.manufacturer,
    name: input.name,
    variant: input.variant ?? null,
    categoryId: input.categoryId ?? null,
    description: input.description ?? null,
    costPerDay: input.costPerDay ?? null,
    rentalDayPrice: input.rentalDayPrice ?? null,
    links: parseLinks(input.linksText),
    notes: input.notes ?? null,
    archived: input.archived,
  };
}

/**
 * The sub-hire catalog: gear partner companies own that we rent in. Items
 * are catalog entries (inventory.write), lines sit on a project
 * (projects.write) and feed its quote and packing lists.
 */
export const subHireItems = {
  async get(id: string) {
    return prisma.subHireItem.findUnique({ where: { id }, include: { owner: { select: { id: true, name: true, organisation: true } }, category: { select: { id: true, name: true } } } });
  },

  async create(actor: Actor, input: SubHireItemInput) {
    assertCan(actor, "inventory.write");
    const owner = await prisma.contact.findUnique({ where: { id: input.ownerContactId }, select: { name: true } });
    if (!owner) throw new SubHireError("Choose the company that owns it.", "ownerContactId");
    const item = await prisma.subHireItem.create({ data: itemData(input) });
    await logActivity(actor, { entityType: "subhire", entityId: item.id, action: "created", summary: `Added ${modelLabel(item)} (rent in from ${owner.name}) to the sub-hire catalog` });
    return item;
  },

  async update(actor: Actor, id: string, input: SubHireItemInput) {
    assertCan(actor, "inventory.write");
    const item = await prisma.subHireItem.update({ where: { id }, data: itemData(input) });
    await logActivity(actor, { entityType: "subhire", entityId: item.id, action: "updated", summary: `Updated sub-hire item ${modelLabel(item)}` });
    return item;
  },

  async setArchived(actor: Actor, id: string, archived: boolean) {
    assertCan(actor, "inventory.write");
    const item = await prisma.subHireItem.update({ where: { id }, data: { archived } });
    await logActivity(actor, { entityType: "subhire", entityId: item.id, action: archived ? "archived" : "unarchived", summary: `${archived ? "Archived" : "Unarchived"} sub-hire item ${modelLabel(item)}` });
    return item;
  },

  /** Items that projects already rent in cannot go; archive them instead. */
  async remove(actor: Actor, id: string) {
    assertCan(actor, "inventory.write");
    const used = await prisma.subHireLine.count({ where: { subHireItemId: id } });
    if (used > 0) throw new SubHireError(`This item is on ${used} project line${used === 1 ? "" : "s"}. Archive it instead.`);
    const item = await prisma.subHireItem.delete({ where: { id } });
    await logActivity(actor, { entityType: "subhire", entityId: id, action: "deleted", summary: `Removed sub-hire item ${modelLabel(item)}` });
  },
};

function lineData(input: SubHireLineInput) {
  return {
    subHireItemId: input.subHireItemId,
    quantity: input.quantity,
    startDate: dateFromString(input.startDate),
    endDate: dateFromString(input.endDate),
    costPerDay: input.costPerDay ?? null,
    pricePerDay: input.pricePerDay ?? null,
    discountPct: input.discountPct ?? null,
    note: input.note ?? null,
  };
}

export const subHireLines = {
  async add(actor: Actor, projectId: string, input: SubHireLineInput) {
    assertCan(actor, "projects.write");
    const item = await prisma.subHireItem.findUnique({ where: { id: input.subHireItemId }, include: { owner: { select: { name: true } } } });
    if (!item) throw new SubHireError("Choose what to rent in.", "subHireItemId");
    if (item.archived) throw new SubHireError("That item is archived.", "subHireItemId");
    // Prices left empty on a new line start from the catalog item.
    const data = lineData(input);
    const num = (v: { toNumber(): number } | null): number | null => (v === null ? null : v.toNumber());
    if (data.costPerDay === null) data.costPerDay = num(item.costPerDay);
    if (data.pricePerDay === null) data.pricePerDay = num(item.rentalDayPrice) ?? num(item.costPerDay);
    const line = await prisma.subHireLine.create({ data: { ...data, projectId } });
    await logActivity(actor, { entityType: "project", entityId: projectId, action: "sub_hire_added", summary: `Rent in ${line.quantity}× ${modelLabel(item)} from ${item.owner.name}`, details: { subHireLineId: line.id } });
    return line;
  },

  async update(actor: Actor, id: string, input: SubHireLineInput) {
    assertCan(actor, "projects.write");
    const before = await prisma.subHireLine.findUnique({ where: { id }, select: { projectId: true, subHireItemId: true } });
    if (!before) throw new SubHireError("That line does not exist.");
    const line = await prisma.subHireLine.update({ where: { id }, data: { ...lineData(input), subHireItemId: before.subHireItemId }, include: { item: { include: { owner: { select: { name: true } } } } } });
    await logActivity(actor, { entityType: "project", entityId: line.projectId, action: "sub_hire_updated", summary: `Rent in ${line.quantity}× ${modelLabel(line.item)} from ${line.item.owner.name}`, details: { subHireLineId: line.id } });
    return line;
  },

  async remove(actor: Actor, id: string) {
    assertCan(actor, "projects.write");
    const line = await prisma.subHireLine.delete({ where: { id }, include: { item: { select: { manufacturer: true, name: true, variant: true } } } });
    await logActivity(actor, { entityType: "project", entityId: line.projectId, action: "sub_hire_removed", summary: `No longer renting in ${modelLabel(line.item)}`, details: { subHireLineId: id } });
    return line;
  },
};
