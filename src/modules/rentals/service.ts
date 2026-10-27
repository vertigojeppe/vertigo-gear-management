import { prisma } from "@/lib/db";
import { diffFields, logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import type { CustomFieldValues } from "@/lib/custom-fields";
import { dateFromString, dateToString, today, type DateString } from "@/lib/dates";
import { emitEvent } from "@/lib/events";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { items as inventoryItems } from "@/modules/inventory/service";
// eslint-disable-next-line no-restricted-imports -- same reason
import { allocationsFor, clients, ConflictError, itemsForModel } from "@/modules/projects/service";
// eslint-disable-next-line no-restricted-imports -- same reason
import { checkRequest } from "@/modules/projects/availability";
import type { RentalStatus } from "../../../config/app.config";
import type { RentalInput, RentalLineInput } from "./schema";
import { modelLabel } from "@/lib/format";

export class RentalError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "RentalError";
  }
}

const num = (v: { toNumber(): number } | number | null | undefined): number | null =>
  v === null || v === undefined ? null : typeof v === "number" ? v : v.toNumber();

export type RentalDto = {
  id: string;
  clientId: string;
  status: RentalStatus;
  /** "overdue" when out and past the end date. */
  effectiveStatus: RentalStatus;
  startDate: DateString;
  endDate: DateString;
  outAt: Date | null;
  returnedAt: Date | null;
  deposit: number | null;
  notes: string | null;
  customFields: CustomFieldValues;
  createdAt: Date;
  updatedAt: Date;
};

type RentalRow = NonNullable<Awaited<ReturnType<typeof prisma.rental.findUnique>>>;

export function toRentalDto(r: RentalRow): RentalDto {
  const status = r.status as RentalStatus;
  const endDate = dateToString(r.endDate);
  return {
    id: r.id,
    clientId: r.clientId,
    status,
    effectiveStatus: status === "out" && endDate < today() ? "overdue" : status,
    startDate: dateToString(r.startDate),
    endDate,
    outAt: r.outAt,
    returnedAt: r.returnedAt,
    deposit: num(r.deposit),
    notes: r.notes,
    customFields: (r.customFields ?? {}) as CustomFieldValues,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export type RentalLineDto = {
  id: string;
  modelId: string;
  modelLabel: string;
  trackingType: string;
  quantity: number;
  pricePerDay: number | null;
  discountPct: number | null;
  itemId: string | null;
  itemTag: string | null;
  note: string | null;
  lineTotal: number;
};

export const rentals = {
  async get(id: string): Promise<RentalDto | null> {
    const r = await prisma.rental.findUnique({ where: { id } });
    return r ? toRentalDto(r) : null;
  },

  async create(actor: Actor, input: RentalInput, customFields: CustomFieldValues = {}): Promise<RentalDto> {
    assertCan(actor, "rentals.write");
    const client = await prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client) throw new RentalError("Client not found.", "clientId");
    const r = await prisma.rental.create({
      data: {
        clientId: input.clientId,
        startDate: dateFromString(input.startDate),
        endDate: dateFromString(input.endDate),
        deposit: input.deposit ?? null,
        notes: input.notes ?? null,
        customFields,
      },
    });
    await clients.ensureLocation(input.clientId);
    await logActivity(actor, { entityType: "rental", entityId: r.id, action: "created", summary: `Created rental for ${client.name} (${input.startDate} – ${input.endDate})` });
    await emitEvent("rental.created", { id: r.id, client: client.name }, { calendar: { kind: "rental", id: r.id } });
    return toRentalDto(r);
  },

  async update(actor: Actor, id: string, input: RentalInput, customFields: CustomFieldValues = {}): Promise<RentalDto> {
    assertCan(actor, "rentals.write");
    const before = await prisma.rental.findUniqueOrThrow({ where: { id } });
    const after = await prisma.$transaction(async (tx) => {
      const r = await tx.rental.update({
        where: { id },
        data: {
          clientId: input.clientId,
          startDate: dateFromString(input.startDate),
          endDate: dateFromString(input.endDate),
          deposit: input.deposit ?? null,
          notes: input.notes ?? null,
          customFields,
        },
      });
      await tx.allocation.updateMany({ where: { rentalId: id }, data: { startDate: r.startDate, endDate: r.endDate } });
      return r;
    });
    await logActivity(actor, {
      entityType: "rental",
      entityId: id,
      action: "updated",
      summary: "Updated rental",
      details: diffFields(toRentalDto(before) as unknown as Record<string, unknown>, toRentalDto(after) as unknown as Record<string, unknown>),
    });
    await emitEvent("rental.created", { id, updated: true }, { calendar: { kind: "rental", id } });
    return toRentalDto(after);
  },

  /** Hand the gear out: assigned units become rented_out at the renter's location. */
  async markOut(actor: Actor, id: string): Promise<RentalDto> {
    assertCan(actor, "rentals.write");
    const r = await prisma.rental.findUniqueOrThrow({ where: { id }, include: { lines: true, client: true } });
    if (r.status !== "reserved") throw new RentalError("Only a reserved rental can be handed out.");
    const location = await clients.ensureLocation(r.clientId);
    for (const line of r.lines) {
      if (line.itemId) await inventoryItems.changeStatus(actor, line.itemId, { status: "rented_out", reason: `Rental to ${r.client.name}`, locationId: location.id }, { viaFlow: true });
    }
    const after = await prisma.rental.update({ where: { id }, data: { status: "out", outAt: new Date() } });
    await logActivity(actor, { entityType: "rental", entityId: id, action: "out", summary: `Handed out to ${r.client.name}` });
    await emitEvent("rental.out", { id, client: r.client.name }, { calendar: { kind: "rental", id } });
    return toRentalDto(after);
  },

  /** Gear came back: assigned units go to in_house at their home location. */
  async markReturned(actor: Actor, id: string): Promise<RentalDto> {
    assertCan(actor, "rentals.write");
    const r = await prisma.rental.findUniqueOrThrow({ where: { id }, include: { lines: { include: { item: true } }, client: true } });
    if (r.status !== "out") throw new RentalError("Only a rental that is out can be returned.");
    for (const line of r.lines) {
      if (line.itemId && line.item) {
        await inventoryItems.changeStatus(
          actor,
          line.itemId,
          { status: "in_house", reason: `Returned from ${r.client.name}`, locationId: line.item.homeLocationId ?? null },
          { viaFlow: true },
        );
      }
    }
    const after = await prisma.rental.update({ where: { id }, data: { status: "returned", returnedAt: new Date() } });
    await logActivity(actor, { entityType: "rental", entityId: id, action: "returned", summary: `Returned by ${r.client.name}` });
    await emitEvent("rental.returned", { id, client: r.client.name }, { calendar: { kind: "rental", id } });
    return toRentalDto(after);
  },

  async remove(actor: Actor, id: string) {
    assertCan(actor, "users.manage");
    const r = await prisma.rental.findUniqueOrThrow({ where: { id }, include: { client: true } });
    if (r.status === "out") throw new RentalError("Gear is still out. Mark it returned first.");
    await prisma.rental.delete({ where: { id } });
    await logActivity(actor, { entityType: "rental", entityId: id, action: "deleted", summary: `Deleted rental for ${r.client.name}` });
    // The ids go with the job: the row that stored them is gone.
    await emitEvent("rental.returned", { id, deleted: true }, { calendar: { kind: "rental", id, eventIds: r.googleEventIds } });
  },
};

/** Models flagged "not for rental" stay on our own projects. */
async function assertRentable(modelId: string) {
  const model = await prisma.model.findUnique({ where: { id: modelId }, select: { manufacturer: true, name: true, variant: true, notForRental: true } });
  if (model?.notForRental) throw new RentalError(`${modelLabel(model)} is not for rental.`, "modelId");
}

export const rentalLines = {
  async add(actor: Actor, rentalId: string, input: RentalLineInput) {
    assertCan(actor, "rentals.write");
    const r = await prisma.rental.findUniqueOrThrow({ where: { id: rentalId } });
    if (r.status === "returned") throw new RentalError("This rental is finished.");
    await assertRentable(input.modelId);
    const from = dateToString(r.startDate);
    const to = dateToString(r.endDate);
    const [items, allocs] = await Promise.all([itemsForModel(input.modelId), allocationsFor(input.modelId, { from, to })]);
    const check = checkRequest(items, allocs, { from, to }, input.quantity, undefined, { forRental: true });
    if (!check.ok && !input.force) throw new ConflictError(check);
    const listPrice = num((await prisma.model.findUnique({ where: { id: input.modelId }, select: { rentalDayPrice: true } }))?.rentalDayPrice);
    const line = await prisma.$transaction(async (tx) => {
      const l = await tx.rentalLine.create({
        data: { rentalId, modelId: input.modelId, quantity: input.quantity, pricePerDay: input.pricePerDay ?? listPrice, discountPct: input.discountPct ?? null, note: input.note ?? null },
        include: { model: true },
      });
      await tx.allocation.create({
        data: { holderType: "rental", rentalId, rentalLineId: l.id, modelId: input.modelId, quantity: input.quantity, startDate: r.startDate, endDate: r.endDate },
      });
      return l;
    });
    await logActivity(actor, { entityType: "rental", entityId: rentalId, action: "line_added", summary: `Added ${line.quantity}× ${modelLabel(line.model)}${check.ok ? "" : " despite a conflict"}` });
    return { line, check };
  },

  async update(actor: Actor, lineId: string, input: RentalLineInput) {
    assertCan(actor, "rentals.write");
    const existing = await prisma.rentalLine.findUniqueOrThrow({ where: { id: lineId }, include: { rental: true, allocation: true } });
    await assertRentable(input.modelId);
    const from = dateToString(existing.rental.startDate);
    const to = dateToString(existing.rental.endDate);
    const [items, allocs] = await Promise.all([itemsForModel(input.modelId), allocationsFor(input.modelId, { from, to })]);
    const check = checkRequest(items, allocs, { from, to }, input.quantity, { allocationId: existing.allocation?.id }, { forRental: true });
    if (!check.ok && !input.force) throw new ConflictError(check);
    const line = await prisma.$transaction(async (tx) => {
      const l = await tx.rentalLine.update({
        where: { id: lineId },
        data: { modelId: input.modelId, quantity: input.quantity, pricePerDay: input.pricePerDay ?? null, discountPct: input.discountPct ?? null, note: input.note ?? null, itemId: input.modelId === existing.modelId ? existing.itemId : null },
        include: { model: true },
      });
      await tx.allocation.updateMany({ where: { rentalLineId: lineId }, data: { modelId: input.modelId, quantity: input.quantity, itemId: l.itemId } });
      return l;
    });
    await logActivity(actor, { entityType: "rental", entityId: existing.rentalId, action: "line_updated", summary: `Updated line ${line.quantity}× ${modelLabel(line.model)}` });
    return { line, check };
  },

  /** Assign (or clear) a specific serialized unit on a line. */
  async assignItem(actor: Actor, lineId: string, itemId: string | null) {
    assertCan(actor, "rentals.write");
    const line = await prisma.rentalLine.findUniqueOrThrow({ where: { id: lineId }, include: { rental: true, model: true } });
    if (itemId) {
      const item = await prisma.item.findUnique({ where: { id: itemId } });
      if (!item || item.modelId !== line.modelId) throw new RentalError("Choose a unit of the same model.", "itemId");
      if (item.notForRental || line.model.notForRental) throw new RentalError(`${item.assetTag} is not for rental.`, "itemId");
      const clash = await prisma.allocation.findFirst({
        where: { itemId, rentalLineId: { not: lineId }, startDate: { lte: line.rental.endDate }, endDate: { gte: line.rental.startDate }, OR: [{ project: { status: { notIn: ["done", "cancelled"] } } }, { rental: { status: { not: "returned" } } }] },
        include: { project: { select: { name: true } }, rental: { select: { client: { select: { name: true } } } } },
      });
      if (clash) throw new RentalError(`${item.assetTag} is already reserved by ${clash.project?.name ?? clash.rental?.client.name ?? "another booking"} in that period.`, "itemId");
    }
    await prisma.$transaction(async (tx) => {
      await tx.rentalLine.update({ where: { id: lineId }, data: { itemId } });
      await tx.allocation.updateMany({ where: { rentalLineId: lineId }, data: { itemId } });
    });
    await logActivity(actor, { entityType: "rental", entityId: line.rentalId, action: "line_assigned", summary: itemId ? `Assigned a unit to ${modelLabel(line.model)}` : `Cleared unit on ${modelLabel(line.model)}` });
  },

  async remove(actor: Actor, lineId: string) {
    assertCan(actor, "rentals.write");
    const line = await prisma.rentalLine.delete({ where: { id: lineId }, include: { model: true } });
    await logActivity(actor, { entityType: "rental", entityId: line.rentalId, action: "line_removed", summary: `Removed ${line.quantity}× ${modelLabel(line.model)}` });
  },
};

