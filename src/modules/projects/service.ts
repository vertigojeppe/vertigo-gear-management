import { prisma } from "@/lib/db";
import { diffFields, logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import type { CustomFieldValues } from "@/lib/custom-fields";
import { dateFromString, dateToString, dayInZone, maxDate, minDate, zonedInputToDate, type DateString } from "@/lib/dates";
import { emitEvent } from "@/lib/events";
import { PROJECT_STATUSES, type ProjectStatus } from "../../../config/app.config";
import { checkRequest, type AllocationLike, type Availability } from "./availability";
import { linksToText, parseLinks, type AllocationInput, type ClientInput, type ContactInput, type CrewInput, type Link, type ProjectInput } from "./schema";
import { modelLabel } from "@/lib/format";

export { linksToText };
export type { Link };

export class ProjectError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ProjectError";
  }
}

/** Thrown when a reservation does not fit and `force` was not set. */
export class ConflictError extends Error {
  constructor(public readonly check: ReturnType<typeof checkRequest>) {
    super(`Only ${check.available} available, ${check.requested} requested.`);
    this.name = "ConflictError";
  }
}

/* ------------------------------------------------------------------------ */
/* Clients                                                                  */
/* ------------------------------------------------------------------------ */

export const clients = {
  async list() {
    return prisma.client.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { projects: true, rentals: true } } } });
  },
  async get(id: string) {
    return prisma.client.findUnique({ where: { id } });
  },
  async create(actor: Actor, input: ClientInput) {
    assertCan(actor, "projects.write");
    const c = await prisma.client.create({ data: clientData(input) });
    await logActivity(actor, { entityType: "project", entityId: c.id, action: "client_created", summary: `Created client ${c.name}` });
    return c;
  },
  async update(actor: Actor, id: string, input: ClientInput) {
    assertCan(actor, "projects.write");
    const c = await prisma.client.update({ where: { id }, data: clientData(input) });
    await prisma.location.updateMany({ where: { renterId: id }, data: { name: c.name } });
    await logActivity(actor, { entityType: "project", entityId: c.id, action: "client_updated", summary: `Updated client ${c.name}` });
    return c;
  },
  async remove(actor: Actor, id: string) {
    assertCan(actor, "projects.write");
    const [projects, rentals] = await Promise.all([prisma.project.count({ where: { clientId: id } }), prisma.rental.count({ where: { clientId: id } })]);
    if (projects + rentals > 0) throw new ProjectError("This client has projects or rentals and cannot be deleted.");
    const c = await prisma.client.delete({ where: { id } });
    await prisma.location.deleteMany({ where: { renterId: id, items: { none: {} } } });
    await logActivity(actor, { entityType: "project", entityId: id, action: "client_deleted", summary: `Deleted client ${c.name}` });
  },
  /** Location of type "renter" for this client (created on demand). */
  async ensureLocation(clientId: string) {
    const existing = await prisma.location.findFirst({ where: { renterId: clientId } });
    if (existing) return existing;
    const c = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    return prisma.location.create({ data: { name: c.name, type: "renter", renterId: clientId } });
  },
};

function clientData(input: ClientInput) {
  return {
    name: input.name,
    contactName: input.contactName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    notes: input.notes ?? null,
  };
}

/* ------------------------------------------------------------------------ */
/* Projects                                                                 */
/* ------------------------------------------------------------------------ */

export type ProjectDto = {
  id: string;
  name: string;
  clientId: string | null;
  venueName: string | null;
  venueAddress: string | null;
  status: ProjectStatus;
  prepStart: string | null;
  prepEnd: string | null;
  buildStart: string | null;
  buildEnd: string | null;
  buildCall: string | null;
  showStart: Date | null;
  showEnd: Date | null;
  packStart: string | null;
  packEnd: string | null;
  packCall: string | null;
  returnDate: string | null;
  reserveFrom: string | null;
  reserveTo: string | null;
  notes: string | null;
  externalLinks: Link[];
  customFields: CustomFieldValues;
  createdAt: Date;
  updatedAt: Date;
};

type ProjectRow = NonNullable<Awaited<ReturnType<typeof prisma.project.findUnique>>>;

const day = (d: Date | null) => (d ? dateToString(d) : null);

export function toProjectDto(p: ProjectRow): ProjectDto {
  return {
    id: p.id,
    name: p.name,
    clientId: p.clientId,
    venueName: p.venueName,
    venueAddress: p.venueAddress,
    status: (PROJECT_STATUSES.find((s) => s.key === p.status)?.key ?? "quote") as ProjectStatus,
    prepStart: day(p.prepStart),
    prepEnd: day(p.prepEnd),
    buildStart: day(p.buildStart),
    buildEnd: day(p.buildEnd),
    buildCall: p.buildCall,
    showStart: p.showStart,
    showEnd: p.showEnd,
    packStart: day(p.packStart),
    packEnd: day(p.packEnd),
    packCall: p.packCall,
    returnDate: day(p.returnDate),
    reserveFrom: p.reserveFrom ? dateToString(p.reserveFrom) : null,
    reserveTo: p.reserveTo ? dateToString(p.reserveTo) : null,
    notes: p.notes,
    externalLinks: Array.isArray(p.externalLinks) ? (p.externalLinks as Link[]) : [],
    customFields: (p.customFields ?? {}) as CustomFieldValues,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** Reservation window = earliest..latest of the phase dates (Copenhagen days). */
export function deriveWindow(input: {
  prepStart?: string | null;
  prepEnd?: string | null;
  buildStart?: string | null;
  buildEnd?: string | null;
  showStart?: Date | null;
  showEnd?: Date | null;
  packStart?: string | null;
  packEnd?: string | null;
  returnDate?: string | null;
}): { from: DateString | null; to: DateString | null } {
  const days = [
    input.prepStart ?? null,
    input.prepEnd ?? null,
    input.buildStart ?? null,
    input.buildEnd ?? null,
    input.showStart ? dayInZone(input.showStart) : null,
    input.showEnd ? dayInZone(input.showEnd) : null,
    input.packStart ?? null,
    input.packEnd ?? null,
    input.returnDate ?? null,
  ];
  return { from: minDate(...days), to: maxDate(...days) };
}

/** A day range where one end alone means a single day; refused when it runs backwards. */
export function dayRange(start: string | undefined, end: string | undefined, field: string): [string | null, string | null] {
  const from = start ?? end ?? null;
  const to = end ?? start ?? null;
  if (from && to && to < from) throw new ProjectError("The last day is before the first day.", field);
  return [from, to];
}

function projectData(input: ProjectInput, customFields: CustomFieldValues) {
  const dt = (s: string | undefined) => (s ? zonedInputToDate(s) : null);
  const asDate = (s: string | null) => (s ? dateFromString(s) : null);
  const [prepStart, prepEnd] = dayRange(input.prepStart, input.prepEnd, "prepEnd");
  const [buildStart, buildEnd] = dayRange(input.buildStart, input.buildEnd, "buildEnd");
  const [packStart, packEnd] = dayRange(input.packStart, input.packEnd, "packEnd");
  const showStart = dt(input.showStart);
  const showEnd = dt(input.showEnd);
  const window = deriveWindow({ prepStart, prepEnd, buildStart, buildEnd, showStart, showEnd, packStart, packEnd, returnDate: input.returnDate });
  return {
    name: input.name,
    clientId: input.clientId ?? null,
    venueName: input.venueName ?? null,
    venueAddress: input.venueAddress ?? null,
    status: input.status,
    prepStart: asDate(prepStart),
    prepEnd: asDate(prepEnd),
    buildStart: asDate(buildStart),
    buildEnd: asDate(buildEnd),
    buildCall: buildStart ? (input.buildCall ?? null) : null,
    showStart,
    showEnd,
    packStart: asDate(packStart),
    packEnd: asDate(packEnd),
    packCall: packStart ? (input.packCall ?? null) : null,
    returnDate: input.returnDate ? dateFromString(input.returnDate) : null,
    reserveFrom: window.from ? dateFromString(window.from) : null,
    reserveTo: window.to ? dateFromString(window.to) : null,
    notes: input.notes ?? null,
    externalLinks: parseLinks(input.linksText),
    customFields,
  };
}

const CALENDAR_FIELDS = ["prepStart", "prepEnd", "buildStart", "buildEnd", "buildCall", "showStart", "showEnd", "packStart", "packEnd", "packCall", "returnDate", "venueName", "venueAddress", "name", "status"] as const;

export const projects = {
  async get(id: string): Promise<ProjectDto | null> {
    const p = await prisma.project.findUnique({ where: { id } });
    return p ? toProjectDto(p) : null;
  },

  async create(actor: Actor, input: ProjectInput, customFields: CustomFieldValues = {}): Promise<ProjectDto> {
    assertCan(actor, "projects.write");
    const p = await prisma.$transaction(async (tx) => {
      const row = await tx.project.create({ data: projectData(input, customFields) });
      await tx.location.create({ data: { name: row.name, type: "project", projectId: row.id } });
      await logActivity(actor, { entityType: "project", entityId: row.id, action: "created", summary: `Created project ${row.name}` }, tx);
      return row;
    });
    await emitEvent("project.created", { id: p.id, name: p.name, status: p.status }, p.status === "confirmed" ? { calendar: { kind: "project", id: p.id } } : {});
    if (p.status === "confirmed") await emitEvent("project.confirmed", { id: p.id, name: p.name }, { calendar: { kind: "project", id: p.id } });
    return toProjectDto(p);
  },

  async update(actor: Actor, id: string, input: ProjectInput, customFields: CustomFieldValues = {}): Promise<ProjectDto> {
    assertCan(actor, "projects.write");
    const before = await prisma.project.findUniqueOrThrow({ where: { id } });
    const data = projectData(input, customFields);
    const after = await prisma.$transaction(async (tx) => {
      const p = await tx.project.update({ where: { id }, data });
      await tx.location.updateMany({ where: { projectId: id }, data: { name: p.name } });
      // Allocations that still follow the old window move with the project.
      if (before.reserveFrom && before.reserveTo && p.reserveFrom && p.reserveTo) {
        await tx.allocation.updateMany({
          where: { projectId: id, startDate: before.reserveFrom, endDate: before.reserveTo },
          data: { startDate: p.reserveFrom, endDate: p.reserveTo },
        });
      }
      return p;
    });
    const beforeDto = toProjectDto(before);
    const afterDto = toProjectDto(after);
    await logActivity(actor, {
      entityType: "project",
      entityId: id,
      action: "updated",
      summary: `Updated project ${after.name}`,
      details: diffFields(beforeDto as unknown as Record<string, unknown>, afterDto as unknown as Record<string, unknown>),
    });
    const calendarRelevant = CALENDAR_FIELDS.some((f) => String(beforeDto[f]) !== String(afterDto[f]));
    if (before.status !== after.status) await projects.emitStatusEvents(before.status, after);
    else if (calendarRelevant && after.status !== "quote") {
      await emitEvent("project.updated", { id, name: after.name }, { calendar: { kind: "project", id } });
    }
    return afterDto;
  },

  async setStatus(actor: Actor, id: string, status: string): Promise<ProjectDto> {
    assertCan(actor, "projects.write");
    if (!PROJECT_STATUSES.some((s) => s.key === status)) throw new ProjectError("Unknown status.", "status");
    const before = await prisma.project.findUniqueOrThrow({ where: { id } });
    if (before.status === status) return toProjectDto(before);
    const after = await prisma.project.update({ where: { id }, data: { status } });
    await logActivity(actor, { entityType: "project", entityId: id, action: "status_changed", summary: `${after.name}: ${before.status} → ${status}` });
    await projects.emitStatusEvents(before.status, after);
    return toProjectDto(after);
  },

  async emitStatusEvents(fromStatus: string, p: { id: string; name: string; status: string }) {
    const cal = { calendar: { kind: "project" as const, id: p.id } };
    if (p.status === "confirmed" && fromStatus !== "confirmed") await emitEvent("project.confirmed", { id: p.id, name: p.name }, cal);
    else if (p.status === "cancelled") await emitEvent("project.cancelled", { id: p.id, name: p.name }, cal);
    else await emitEvent("project.updated", { id: p.id, name: p.name, status: p.status }, p.status === "quote" ? {} : cal);
  },

  async remove(actor: Actor, id: string) {
    assertCan(actor, "users.manage");
    const p = await prisma.project.findUniqueOrThrow({ where: { id } });
    const itemsAtProject = await prisma.item.count({ where: { location: { projectId: id } } });
    if (itemsAtProject > 0) throw new ProjectError("Items are still at this project. Check them in first.");
    await prisma.$transaction(async (tx) => {
      await tx.location.deleteMany({ where: { projectId: id } });
      await tx.project.delete({ where: { id } });
      await logActivity(actor, { entityType: "project", entityId: id, action: "deleted", summary: `Deleted project ${p.name}` }, tx);
    });
    await emitEvent("project.cancelled", { id, name: p.name, deleted: true }, { calendar: { kind: "project", id } });
  },

  /* Contacts */
  async addContact(actor: Actor, projectId: string, input: ContactInput) {
    assertCan(actor, "projects.write");
    const c = await prisma.projectContact.create({ data: { projectId, ...input, role: input.role ?? null, phone: input.phone ?? null, email: input.email ?? null, notes: input.notes ?? null } });
    await logActivity(actor, { entityType: "project", entityId: projectId, action: "contact_added", summary: `Added contact ${c.name}` });
    return c;
  },
  async removeContact(actor: Actor, contactId: string) {
    assertCan(actor, "projects.write");
    const c = await prisma.projectContact.delete({ where: { id: contactId } });
    await logActivity(actor, { entityType: "project", entityId: c.projectId, action: "contact_removed", summary: `Removed contact ${c.name}` });
  },

  /* Crew */
  async addCrew(actor: Actor, projectId: string, input: CrewInput) {
    assertCan(actor, "projects.write");
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new ProjectError("User not found.", "userId");
    const row = await prisma.projectCrew.upsert({
      where: { projectId_userId: { projectId, userId: input.userId } },
      create: { projectId, userId: input.userId, role: input.role ?? null, callTime: input.callTime ? zonedInputToDate(input.callTime) : null, notes: input.notes ?? null },
      update: { role: input.role ?? null, callTime: input.callTime ? zonedInputToDate(input.callTime) : null, notes: input.notes ?? null },
    });
    await logActivity(actor, { entityType: "project", entityId: projectId, action: "crew_added", summary: `Added ${user.name} to the crew${input.role ? ` as ${input.role}` : ""}` });
    const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    if (p.status !== "quote") await emitEvent("project.updated", { id: projectId, name: p.name, crew: true }, { calendar: { kind: "project", id: projectId } });
    return row;
  },
  async removeCrew(actor: Actor, crewId: string) {
    assertCan(actor, "projects.write");
    const row = await prisma.projectCrew.delete({ where: { id: crewId }, include: { user: true } });
    await logActivity(actor, { entityType: "project", entityId: row.projectId, action: "crew_removed", summary: `Removed ${row.user.name} from the crew` });
  },
};

/* ------------------------------------------------------------------------ */
/* Reservations (allocations)                                               */
/* ------------------------------------------------------------------------ */

export async function allocationsFor(modelId: string): Promise<AllocationLike[]> {
  const rows = await prisma.allocation.findMany({
    where: { modelId },
    include: { project: { select: { id: true, name: true, status: true } }, rental: { select: { id: true, client: { select: { name: true } }, status: true } } },
  });
  return rows
    .filter((a) => (a.project ? a.project.status !== "cancelled" && a.project.status !== "done" : true) && (a.rental ? a.rental.status !== "returned" : true))
    .map((a) => ({
      id: a.id,
      holderType: a.holderType as "project" | "rental",
      holderId: a.projectId ?? a.rentalId ?? "",
      holderName: a.project?.name ?? (a.rental ? `Rental: ${a.rental.client.name}` : "?"),
      modelId: a.modelId,
      quantity: a.quantity,
      itemId: a.itemId,
      startDate: dateToString(a.startDate),
      endDate: dateToString(a.endDate),
    }));
}

export async function itemsForModel(modelId: string) {
  return prisma.item.findMany({ where: { modelId }, select: { id: true, quantity: true, status: true, notForRental: true } });
}

/** Availability of a model in a window, optionally ignoring one holder. */
export async function modelAvailability(modelId: string, from: DateString, to: DateString, exclude?: { holderType: "project" | "rental"; holderId: string }): Promise<Availability> {
  const [items, allocs] = await Promise.all([itemsForModel(modelId), allocationsFor(modelId)]);
  return checkRequest(items, allocs, { from, to }, 0, exclude);
}

export const allocations = {
  /** Reserve for a project. Throws ConflictError unless `force`. */
  async reserve(actor: Actor, projectId: string, input: AllocationInput) {
    assertCan(actor, "projects.write");
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const [items, allocs] = await Promise.all([itemsForModel(input.modelId), allocationsFor(input.modelId)]);
    const check = checkRequest(items, allocs, { from: input.startDate, to: input.endDate }, input.quantity);
    if (!check.ok && !input.force) throw new ConflictError(check);
    const listPrice = (await prisma.model.findUnique({ where: { id: input.modelId }, select: { rentalDayPrice: true } }))?.rentalDayPrice ?? null;
    const row = await prisma.allocation.create({
      data: {
        holderType: "project",
        projectId,
        modelId: input.modelId,
        quantity: input.quantity,
        startDate: dateFromString(input.startDate),
        endDate: dateFromString(input.endDate),
        note: input.note ?? null,
        pricePerDay: input.pricePerDay ?? listPrice,
        discountPct: input.discountPct ?? null,
      },
      include: { model: true },
    });
    await logActivity(actor, {
      entityType: "project",
      entityId: projectId,
      action: "reserved",
      summary: `Reserved ${row.quantity}× ${modelLabel(row.model)} (${input.startDate} – ${input.endDate})${check.ok ? "" : " despite a conflict"}`,
    });
    void project;
    return { allocation: row, check };
  },

  async update(actor: Actor, allocationId: string, input: AllocationInput) {
    assertCan(actor, "projects.write");
    const existing = await prisma.allocation.findUniqueOrThrow({ where: { id: allocationId } });
    const [items, allocs] = await Promise.all([itemsForModel(input.modelId), allocationsFor(input.modelId)]);
    const check = checkRequest(items, allocs, { from: input.startDate, to: input.endDate }, input.quantity, { allocationId });
    if (!check.ok && !input.force) throw new ConflictError(check);
    const row = await prisma.allocation.update({
      where: { id: allocationId },
      data: {
        modelId: input.modelId,
        quantity: input.quantity,
        startDate: dateFromString(input.startDate),
        endDate: dateFromString(input.endDate),
        note: input.note ?? null,
        pricePerDay: input.pricePerDay ?? null,
        discountPct: input.discountPct ?? null,
      },
      include: { model: true },
    });
    await logActivity(actor, {
      entityType: "project",
      entityId: existing.projectId ?? existing.rentalId ?? "",
      action: "reservation_updated",
      summary: `Updated reservation: ${row.quantity}× ${modelLabel(row.model)} (${input.startDate} – ${input.endDate})`,
    });
    return { allocation: row, check };
  },

  async remove(actor: Actor, allocationId: string) {
    assertCan(actor, "projects.write");
    const row = await prisma.allocation.delete({ where: { id: allocationId }, include: { model: true } });
    await logActivity(actor, {
      entityType: "project",
      entityId: row.projectId ?? row.rentalId ?? "",
      action: "reservation_removed",
      summary: `Removed reservation ${row.quantity}× ${modelLabel(row.model)}`,
    });
  },
};
