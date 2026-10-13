import { prisma } from "@/lib/db";
import { logActivity, diffFields } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { nextAssetTag, normaliseAssetTag } from "@/lib/asset-tag";
import { emitEvent } from "@/lib/events";
import type { CustomFieldValues } from "@/lib/custom-fields";
import { itemStatus, type ItemStatus } from "../../../config/app.config";
import type { CategoryInput, ItemInput, LocationInput, ModelInput, StatusChangeInput } from "./schema";
import { parseLinksText } from "./schema";
import { validateStatusChange } from "./status";
import { descendantIds, wouldCycle } from "./tree";
import { modelLabel } from "@/lib/format";

export class InventoryError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "InventoryError";
  }
}

const num = (v: { toNumber(): number } | number | null | undefined): number | null =>
  v === null || v === undefined ? null : typeof v === "number" ? v : v.toNumber();

/* ------------------------------------------------------------------------ */
/* Categories                                                               */
/* ------------------------------------------------------------------------ */

export const categories = {
  async list() {
    return prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  },

  async create(actor: Actor, input: CategoryInput) {
    assertCan(actor, "inventory.write");
    const cat = await prisma.category.create({
      data: { name: input.name, parentId: input.parentId ?? null, sortOrder: input.sortOrder },
    });
    await logActivity(actor, { entityType: "category", entityId: cat.id, action: "created", summary: `Created category ${cat.name}` });
    return cat;
  },

  async update(actor: Actor, id: string, input: CategoryInput) {
    assertCan(actor, "inventory.write");
    const rows = await prisma.category.findMany({ select: { id: true, name: true, parentId: true } });
    if (wouldCycle(rows, id, input.parentId ?? null)) {
      throw new InventoryError("A category cannot be moved inside itself.", "parentId");
    }
    const cat = await prisma.category.update({
      where: { id },
      data: { name: input.name, parentId: input.parentId ?? null, sortOrder: input.sortOrder },
    });
    await logActivity(actor, { entityType: "category", entityId: cat.id, action: "updated", summary: `Updated category ${cat.name}` });
    return cat;
  },

  async remove(actor: Actor, id: string) {
    assertCan(actor, "inventory.write");
    const [children, models] = await Promise.all([
      prisma.category.count({ where: { parentId: id } }),
      prisma.model.count({ where: { categoryId: id } }),
    ]);
    if (children > 0) throw new InventoryError("Move or delete its subcategories first.");
    if (models > 0) throw new InventoryError("Move its models to another category first.");
    const cat = await prisma.category.delete({ where: { id } });
    await logActivity(actor, { entityType: "category", entityId: id, action: "deleted", summary: `Deleted category ${cat.name}` });
  },
};

/* ------------------------------------------------------------------------ */
/* Locations                                                                */
/* ------------------------------------------------------------------------ */

/** type = person must point at a user or a contact; other types clear both. */
function personRefs(input: LocationInput): { userId: string | null; contactId: string | null } {
  if (input.type !== "person") return { userId: null, contactId: null };
  const [kind, id] = (input.person ?? "").split(":");
  if (kind === "user" && id) return { userId: id, contactId: null };
  if (kind === "contact" && id) return { userId: null, contactId: id };
  throw new InventoryError("Choose who holds the gear.", "person");
}

export const locations = {
  async list() {
    return prisma.location.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });
  },

  async create(actor: Actor, input: LocationInput) {
    assertCan(actor, "inventory.write");
    const loc = await prisma.location.create({
      data: { name: input.name, type: input.type, parentId: input.parentId ?? null, notes: input.notes ?? null, ...personRefs(input) },
    });
    await logActivity(actor, { entityType: "location", entityId: loc.id, action: "created", summary: `Created location ${loc.name}` });
    return loc;
  },

  async update(actor: Actor, id: string, input: LocationInput) {
    assertCan(actor, "inventory.write");
    const rows = await prisma.location.findMany({ select: { id: true, name: true, parentId: true } });
    if (wouldCycle(rows, id, input.parentId ?? null)) {
      throw new InventoryError("A location cannot be moved inside itself.", "parentId");
    }
    const loc = await prisma.location.update({
      where: { id },
      data: { name: input.name, type: input.type, parentId: input.parentId ?? null, notes: input.notes ?? null, ...personRefs(input) },
    });
    await logActivity(actor, { entityType: "location", entityId: loc.id, action: "updated", summary: `Updated location ${loc.name}` });
    return loc;
  },

  async remove(actor: Actor, id: string) {
    assertCan(actor, "inventory.write");
    const [children, items] = await Promise.all([
      prisma.location.count({ where: { parentId: id } }),
      prisma.item.count({ where: { locationId: id } }),
    ]);
    if (children > 0) throw new InventoryError("Move or delete its sub-locations first.");
    if (items > 0) throw new InventoryError("Move the items stored here first.");
    const loc = await prisma.location.delete({ where: { id } });
    await logActivity(actor, { entityType: "location", entityId: id, action: "deleted", summary: `Deleted location ${loc.name}` });
  },
};

/* ------------------------------------------------------------------------ */
/* Models                                                                   */
/* ------------------------------------------------------------------------ */

export type Link = { label: string; url: string };

export type ModelDto = {
  id: string;
  categoryId: string;
  manufacturer: string;
  name: string;
  variant: string | null;
  trackingType: "serialized" | "bulk";
  description: string | null;
  weightKg: number | null;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  powerDrawW: number | null;
  notes: string | null;
  links: Link[];
  defaultPhotoId: string | null;
  customFields: CustomFieldValues;
  archived: boolean;
  notForRental: boolean;
  rentalDayPrice: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type ModelRow = NonNullable<Awaited<ReturnType<typeof prisma.model.findUnique>>>;

export function toModelDto(m: ModelRow): ModelDto {
  return {
    id: m.id,
    categoryId: m.categoryId,
    manufacturer: m.manufacturer,
    name: m.name,
    variant: m.variant,
    trackingType: m.trackingType === "bulk" ? "bulk" : "serialized",
    description: m.description,
    weightKg: num(m.weightKg),
    widthCm: num(m.widthCm),
    heightCm: num(m.heightCm),
    depthCm: num(m.depthCm),
    powerDrawW: m.powerDrawW,
    notes: m.notes,
    links: Array.isArray(m.links) ? (m.links as Link[]) : [],
    defaultPhotoId: m.defaultPhotoId,
    customFields: (m.customFields ?? {}) as CustomFieldValues,
    archived: m.archived,
    notForRental: m.notForRental,
    rentalDayPrice: num(m.rentalDayPrice),
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

function modelData(input: ModelInput, customFields: CustomFieldValues) {
  return {
    categoryId: input.categoryId,
    manufacturer: input.manufacturer,
    name: input.name,
    variant: input.variant ?? null,
    trackingType: input.trackingType,
    description: input.description ?? null,
    weightKg: input.weightKg ?? null,
    widthCm: input.widthCm ?? null,
    heightCm: input.heightCm ?? null,
    depthCm: input.depthCm ?? null,
    powerDrawW: input.powerDrawW ?? null,
    notes: input.notes ?? null,
    links: parseLinksText(input.linksText),
    notForRental: input.notForRental,
    rentalDayPrice: input.rentalDayPrice ?? null,
    customFields,
  };
}

export const models = {
  async get(id: string): Promise<ModelDto | null> {
    const m = await prisma.model.findUnique({ where: { id } });
    return m ? toModelDto(m) : null;
  },

  async create(actor: Actor, input: ModelInput, customFields: CustomFieldValues = {}) {
    assertCan(actor, "inventory.write");
    const m = await prisma.model.create({ data: modelData(input, customFields) });
    await logActivity(actor, {
      entityType: "model",
      entityId: m.id,
      action: "created",
      summary: `Created model ${modelLabel(m)}`,
    });
    return toModelDto(m);
  },

  async update(actor: Actor, id: string, input: ModelInput, customFields: CustomFieldValues = {}) {
    assertCan(actor, "inventory.write");
    const before = await prisma.model.findUniqueOrThrow({ where: { id } });
    if (before.trackingType !== input.trackingType) {
      const count = await prisma.item.count({ where: { modelId: id } });
      if (count > 0) throw new InventoryError("Tracking type cannot change once items exist.", "trackingType");
    }
    const data = modelData(input, customFields);
    const m = await prisma.model.update({ where: { id }, data });
    await logActivity(actor, {
      entityType: "model",
      entityId: m.id,
      action: "updated",
      summary: `Updated model ${modelLabel(m)}`,
      details: diffFields(toModelDto(before) as unknown as Record<string, unknown>, toModelDto(m) as unknown as Record<string, unknown>),
    });
    return toModelDto(m);
  },

  async setArchived(actor: Actor, id: string, archived: boolean) {
    assertCan(actor, "inventory.write");
    const m = await prisma.model.update({ where: { id }, data: { archived } });
    await logActivity(actor, {
      entityType: "model",
      entityId: id,
      action: archived ? "archived" : "unarchived",
      summary: `${archived ? "Archived" : "Unarchived"} model ${modelLabel(m)}`,
    });
    return toModelDto(m);
  },

  async setDefaultPhoto(actor: Actor, id: string, fileId: string | null) {
    assertCan(actor, "inventory.write");
    await prisma.model.update({ where: { id }, data: { defaultPhotoId: fileId } });
  },

  async remove(actor: Actor, id: string) {
    assertCan(actor, "inventory.write");
    const usage = await modelUsage(id);
    if (usage.total > 0) throw new InventoryError(`This model is still used by ${usage.summary}. Archive it instead.`);
    const m = await prisma.model.delete({ where: { id } });
    await logActivity(actor, { entityType: "model", entityId: id, action: "deleted", summary: `Deleted model ${modelLabel(m)}` });
  },
};

/** Everything that still points at a model; a model can only be deleted when this is empty. */
export type ModelUsage = { items: number; reservations: number; rentalLines: number; packingLines: number; templateLines: number; total: number; summary: string };

export async function modelUsage(id: string): Promise<ModelUsage> {
  const [items, reservations, rentalLines, packingLines, templateLines] = await Promise.all([
    prisma.item.count({ where: { modelId: id } }),
    prisma.allocation.count({ where: { modelId: id, holderType: "project" } }),
    prisma.rentalLine.count({ where: { modelId: id } }),
    prisma.packingLine.count({ where: { modelId: id } }),
    prisma.packingTemplateLine.count({ where: { modelId: id } }),
  ]);
  const parts = [
    [items, "item", "items"],
    [reservations, "reservation", "reservations"],
    [rentalLines, "rental line", "rental lines"],
    [packingLines, "packing list line", "packing list lines"],
    [templateLines, "template line", "template lines"],
  ] as const;
  const summary = parts
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
    .join(", ");
  return { items, reservations, rentalLines, packingLines, templateLines, total: items + reservations + rentalLines + packingLines + templateLines, summary };
}

/* ------------------------------------------------------------------------ */
/* Items                                                                    */
/* ------------------------------------------------------------------------ */

export type ItemDto = {
  id: string;
  modelId: string;
  assetTag: string;
  serialNumber: string | null;
  quantity: number;
  status: ItemStatus;
  locationId: string | null;
  parentItemId: string | null;
  isKit: boolean;
  name: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  supplier: string | null;
  insuredValue: number | null;
  replacementValue: number | null;
  conditionNotes: string | null;
  notes: string | null;
  notForRental: boolean;
  retiredReason: string | null;
  customFields: CustomFieldValues;
  createdAt: Date;
  updatedAt: Date;
};

type ItemRow = NonNullable<Awaited<ReturnType<typeof prisma.item.findUnique>>>;

export function toItemDto(i: ItemRow): ItemDto {
  return {
    id: i.id,
    modelId: i.modelId,
    assetTag: i.assetTag,
    serialNumber: i.serialNumber,
    quantity: i.quantity,
    status: (itemStatus(i.status)?.key ?? "in_house") as ItemStatus,
    locationId: i.locationId,
    parentItemId: i.parentItemId,
    isKit: i.isKit,
    name: i.name,
    purchaseDate: i.purchaseDate ? i.purchaseDate.toISOString().slice(0, 10) : null,
    purchasePrice: num(i.purchasePrice),
    supplier: i.supplier,
    insuredValue: num(i.insuredValue),
    replacementValue: num(i.replacementValue),
    conditionNotes: i.conditionNotes,
    notes: i.notes,
    notForRental: i.notForRental,
    retiredReason: i.retiredReason,
    customFields: (i.customFields ?? {}) as CustomFieldValues,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

/** Strip finance fields for actors without inventory.finance. */
export function redactFinance<T extends Partial<ItemDto>>(actor: Actor, item: T): T {
  if (actorCanSeeFinance(actor)) return item;
  return { ...item, purchasePrice: null, insuredValue: null, replacementValue: null };
}

export function actorCanSeeFinance(actor: Actor): boolean {
  try {
    assertCan(actor, "inventory.finance");
    return true;
  } catch {
    return false;
  }
}

function itemData(input: ItemInput, tracking: "serialized" | "bulk", customFields: CustomFieldValues) {
  return {
    serialNumber: tracking === "serialized" ? (input.serialNumber ?? null) : null,
    quantity: tracking === "bulk" ? input.quantity : 1,
    locationId: input.locationId ?? null,
    isKit: tracking === "serialized" ? input.isKit : false,
    name: input.name ?? null,
    purchaseDate: input.purchaseDate ? new Date(input.purchaseDate + "T00:00:00Z") : null,
    purchasePrice: input.purchasePrice ?? null,
    supplier: input.supplier ?? null,
    insuredValue: input.insuredValue ?? null,
    replacementValue: input.replacementValue ?? null,
    conditionNotes: input.conditionNotes ?? null,
    notes: input.notes ?? null,
    notForRental: input.notForRental,
    customFields,
  };
}

function itemLabel(i: { assetTag: string; name: string | null; serialNumber: string | null }): string {
  return i.name ? `${i.name} (${i.assetTag})` : i.serialNumber ? `${i.assetTag} / SN ${i.serialNumber}` : i.assetTag;
}

export const items = {
  async get(id: string): Promise<ItemDto | null> {
    const i = await prisma.item.findUnique({ where: { id } });
    return i ? toItemDto(i) : null;
  },

  async findByAssetTag(tag: string): Promise<ItemDto | null> {
    const normalised = normaliseAssetTag(tag);
    if (!normalised) return null;
    const i = await prisma.item.findFirst({ where: { assetTag: { equals: normalised, mode: "insensitive" } } });
    return i ? toItemDto(i) : null;
  },

  /**
   * Create one or more items. For serialized models `count` units are
   * created (optionally with one serial number each). Bulk models always
   * create exactly one bin.
   */
  async create(
    actor: Actor,
    input: ItemInput,
    opts: { count?: number; serialNumbers?: string[]; customFields?: CustomFieldValues } = {},
  ): Promise<ItemDto[]> {
    assertCan(actor, "inventory.write");
    const model = await prisma.model.findUnique({ where: { id: input.modelId } });
    if (!model) throw new InventoryError("Model not found.", "modelId");
    const tracking = model.trackingType === "bulk" ? "bulk" : "serialized";
    const count = tracking === "bulk" ? 1 : Math.max(1, opts.count ?? 1);
    if (tracking === "bulk" && input.isKit) throw new InventoryError("Only serialized items can be kits.", "isKit");
    if (input.isKit && !input.name) throw new InventoryError("Give the kit a name.", "name");
    let homeLocationId: string | null = null;
    if (input.locationId) {
      const loc = await prisma.location.findUnique({ where: { id: input.locationId } });
      if (!loc) throw new InventoryError("Location not found.", "locationId");
      if (loc.type === "warehouse") homeLocationId = loc.id;
    }

    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (let n = 0; n < count; n++) {
        const assetTag = await nextAssetTag(tx);
        const serial = opts.serialNumbers?.[n]?.trim() || (count === 1 ? (input.serialNumber ?? null) : null);
        const row = await tx.item.create({
          data: {
            modelId: model.id,
            assetTag,
            ...itemData(input, tracking, opts.customFields ?? {}),
            homeLocationId,
            serialNumber: tracking === "serialized" ? serial : null,
            status: "in_house",
          },
        });
        await tx.statusLog.create({
          data: { itemId: row.id, fromStatus: null, toStatus: "in_house", reason: "Created", userId: actor.id },
        });
        await logActivity(
          actor,
          {
            entityType: "item",
            entityId: row.id,
            action: "created",
            summary: `Added ${itemLabel(row)} (${modelLabel(model)})`,
          },
          tx,
        );
        rows.push(row);
      }
      return rows;
    });
    return created.map(toItemDto);
  },

  async update(actor: Actor, id: string, input: ItemInput, customFields: CustomFieldValues = {}) {
    assertCan(actor, "inventory.write");
    const before = await prisma.item.findUniqueOrThrow({ where: { id }, include: { model: true } });
    if (input.modelId !== before.modelId) {
      const model = await prisma.model.findUnique({ where: { id: input.modelId } });
      if (!model) throw new InventoryError("Model not found.", "modelId");
      if (model.trackingType !== before.model.trackingType) {
        throw new InventoryError("Cannot move an item to a model with a different tracking type.", "modelId");
      }
    }
    const tracking = before.model.trackingType === "bulk" ? "bulk" : "serialized";
    if (before.isKit && !input.isKit) {
      const contents = await prisma.item.count({ where: { parentItemId: id } });
      if (contents > 0) throw new InventoryError("Empty the kit before turning it into a plain item.", "isKit");
    }
    if (input.isKit && !input.name) throw new InventoryError("Give the kit a name.", "name");
    const data = { modelId: input.modelId, ...itemData(input, tracking, customFields) };
    const after = await prisma.item.update({ where: { id }, data });
    const financeChanged = ["purchasePrice", "insuredValue", "replacementValue"].some(
      (k) => String(before[k as keyof typeof before]) !== String(after[k as keyof typeof after]),
    );
    if (financeChanged) assertCan(actor, "inventory.finance");
    await logActivity(actor, {
      entityType: "item",
      entityId: id,
      action: "updated",
      summary: `Updated ${itemLabel(after)}`,
      details: diffFields(toItemDto(before) as unknown as Record<string, unknown>, toItemDto(after) as unknown as Record<string, unknown>),
    });
    return toItemDto(after);
  },

  /**
   * Manual status change with reason. Cascades to kit contents.
   * Flow-driven changes (check-out etc.) pass viaFlow and may use statuses
   * that are not manual.
   */
  async changeStatus(actor: Actor, id: string, input: StatusChangeInput, opts: { viaFlow?: boolean } = {}) {
    assertCan(actor, "inventory.write");
    const item = await prisma.item.findUniqueOrThrow({ where: { id } });
    const problem = validateStatusChange(item.status, input.status, input.reason, opts);
    if (problem === "unknown_status") throw new InventoryError("Unknown status.", "status");
    if (problem === "same_status") throw new InventoryError("The item already has that status.", "status");
    if (problem === "not_manual") throw new InventoryError("That status is set by check-out and rentals, not by hand.", "status");
    if (problem === "reason_required") throw new InventoryError("Give a reason for this status.", "reason");
    if (input.status === "retired" && !input.retiredReason) throw new InventoryError("Say why it was retired: sold, scrapped or lost.", "retiredReason");
    const retiredReason = input.status === "retired" ? (input.retiredReason ?? null) : null;

    const targets = [item, ...(item.isKit ? await prisma.item.findMany({ where: { parentItemId: id } }) : [])];
    await prisma.$transaction(async (tx) => {
      for (const t of targets) {
        await tx.item.update({
          where: { id: t.id },
          data: { status: input.status, retiredReason, ...(input.locationId !== undefined ? { locationId: input.locationId } : {}) },
        });
        await tx.statusLog.create({
          data: {
            itemId: t.id,
            fromStatus: t.status,
            toStatus: input.status,
            reason: t.id === id ? (input.reason ?? null) : `With kit ${itemLabel(item)}`,
            userId: actor.id,
          },
        });
        await logActivity(
          actor,
          {
            entityType: "item",
            entityId: t.id,
            action: "status_changed",
            summary: `${itemLabel(t)}: ${t.status} → ${input.status}${input.reason ? ` (${input.reason})` : ""}`,
            details: { from: t.status, to: input.status, reason: input.reason ?? null },
          },
          tx,
        );
      }
    });
    await emitEvent("item.status_changed", {
      itemId: id,
      assetTag: item.assetTag,
      from: item.status,
      to: input.status,
      reason: input.reason ?? null,
      cascadedTo: targets.slice(1).map((t) => t.assetTag),
      by: actor.name,
    });
    return (await items.get(id))!;
  },

  /** Move to a location. Cascades to kit contents. */
  async move(actor: Actor, id: string, locationId: string | null) {
    assertCan(actor, "inventory.write");
    const item = await prisma.item.findUniqueOrThrow({ where: { id } });
    if (locationId) {
      const loc = await prisma.location.findUnique({ where: { id: locationId } });
      if (!loc) throw new InventoryError("Location not found.", "locationId");
    }
    const targets = [item, ...(item.isKit ? await prisma.item.findMany({ where: { parentItemId: id } }) : [])];
    const locName = locationId ? (await prisma.location.findUnique({ where: { id: locationId } }))?.name : "no location";
    const destination = locationId ? await prisma.location.findUnique({ where: { id: locationId } }) : null;
    const homeUpdate = destination?.type === "warehouse" ? { homeLocationId: destination.id } : {};
    await prisma.$transaction(async (tx) => {
      for (const t of targets) {
        await tx.item.update({ where: { id: t.id }, data: { locationId, ...homeUpdate } });
        await logActivity(
          actor,
          { entityType: "item", entityId: t.id, action: "moved", summary: `Moved ${itemLabel(t)} to ${locName}` },
          tx,
        );
      }
    });
    return (await items.get(id))!;
  },

  /** Put an item into a kit. The item takes the kit's location and status. */
  async addToKit(actor: Actor, kitId: string, itemId: string) {
    assertCan(actor, "inventory.write");
    if (kitId === itemId) throw new InventoryError("A kit cannot contain itself.");
    const [kit, item] = await Promise.all([
      prisma.item.findUniqueOrThrow({ where: { id: kitId } }),
      prisma.item.findUniqueOrThrow({ where: { id: itemId } }),
    ]);
    if (!kit.isKit) throw new InventoryError("Target is not a kit.");
    if (item.isKit) {
      // Prevent cycles: walk up from the kit; the item must not be an ancestor.
      let cursor: string | null = kit.parentItemId;
      let guard = 0;
      while (cursor && guard++ < 100) {
        if (cursor === itemId) throw new InventoryError("That would put a kit inside itself.");
        const parent: { parentItemId: string | null } | null = await prisma.item.findUnique({ where: { id: cursor }, select: { parentItemId: true } });
        cursor = parent?.parentItemId ?? null;
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.item.update({
        where: { id: itemId },
        data: { parentItemId: kitId, locationId: kit.locationId, status: kit.status },
      });
      if (item.status !== kit.status) {
        await tx.statusLog.create({
          data: { itemId, fromStatus: item.status, toStatus: kit.status, reason: `Added to kit ${itemLabel(kit)}`, userId: actor.id },
        });
      }
      await logActivity(
        actor,
        { entityType: "item", entityId: itemId, action: "kit_added", summary: `Put ${itemLabel(item)} into ${itemLabel(kit)}` },
        tx,
      );
      await logActivity(
        actor,
        { entityType: "item", entityId: kitId, action: "kit_added", summary: `Added ${itemLabel(item)} to kit` },
        tx,
      );
    });
  },

  async removeFromKit(actor: Actor, itemId: string) {
    assertCan(actor, "inventory.write");
    const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId }, include: { parentItem: true } });
    if (!item.parentItemId || !item.parentItem) return;
    await prisma.$transaction(async (tx) => {
      await tx.item.update({ where: { id: itemId }, data: { parentItemId: null } });
      await logActivity(
        actor,
        { entityType: "item", entityId: itemId, action: "kit_removed", summary: `Took ${itemLabel(item)} out of ${itemLabel(item.parentItem!)}` },
        tx,
      );
      await logActivity(
        actor,
        { entityType: "item", entityId: item.parentItemId!, action: "kit_removed", summary: `Removed ${itemLabel(item)} from kit` },
        tx,
      );
    });
  },

  async remove(actor: Actor, id: string) {
    assertCan(actor, "users.manage"); // admin only: deleting loses history
    const item = await prisma.item.findUniqueOrThrow({ where: { id } });
    const contents = await prisma.item.count({ where: { parentItemId: id } });
    if (contents > 0) throw new InventoryError("Empty the kit before deleting it.");
    await prisma.$transaction(async (tx) => {
      await tx.item.delete({ where: { id } });
      await logActivity(actor, { entityType: "item", entityId: id, action: "deleted", summary: `Deleted ${itemLabel(item)}` }, tx);
    });
  },
};

/* ------------------------------------------------------------------------ */
/* Helpers shared with queries                                              */
/* ------------------------------------------------------------------------ */

export async function categoryIdsIncludingChildren(categoryId: string): Promise<string[]> {
  const rows = await prisma.category.findMany({ select: { id: true, name: true, parentId: true } });
  return descendantIds(rows, categoryId);
}
