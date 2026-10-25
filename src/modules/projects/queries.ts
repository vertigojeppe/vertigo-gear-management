import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { activityFor } from "@/lib/activity";
import { addDays, dateToString, today, type DateString } from "@/lib/dates";
import { appConfig, PROJECT_STATUSES } from "../../../config/app.config";
import { checkRequest, overbookedDays, type AllocationLike } from "./availability";
import type { ProjectFilters } from "./schema";
import { allocationsFor, itemsForModel, toProjectDto, type ProjectDto } from "./service";
import { modelLabel } from "@/lib/format";
import { bestMatches } from "@/lib/search";

const PAGE = appConfig.pageSize;

export async function clientOptions() {
  return prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function crewOptions() {
  return prisma.user.findMany({ where: { active: true, role: { not: "display" } }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } });
}

/* Projects list */

export type ProjectListRow = ProjectDto & { clientName: string | null; crewCount: number; reservationCount: number };

export async function listProjects(filters: ProjectFilters): Promise<{ rows: ProjectListRow[]; total: number; page: number; pages: number; closeMatches: boolean }> {
  const where: Prisma.ProjectWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.clientId) where.clientId = filters.clientId;
  const when = filters.when ?? "upcoming";
  const t = today();
  if (when === "upcoming") where.AND = [{ OR: [{ reserveTo: { gte: new Date(`${t}T00:00:00Z`) } }, { reserveTo: null }] }, { status: { notIn: ["done", "cancelled"] } }];
  if (when === "past") where.OR = [{ reserveTo: { lt: new Date(`${t}T00:00:00Z`) } }, { status: { in: ["done", "cancelled"] } }];
  // Forgiving search over the projects the other filters allow (spaces, case, typos).
  let closeMatches = false;
  if (filters.q) {
    const candidates = await prisma.project.findMany({ where, select: { id: true, name: true, venueName: true, client: { select: { name: true } } } });
    const found = bestMatches(candidates, (p) => [p.name, p.venueName, p.client?.name], filters.q);
    where.id = { in: found.rows.map((p) => p.id) };
    closeMatches = found.close;
  }

  const [total, rows] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: when === "past" ? [{ reserveFrom: "desc" }] : [{ reserveFrom: "asc" }, { name: "asc" }],
      skip: (filters.page - 1) * PAGE,
      take: PAGE,
      include: { client: { select: { name: true } }, _count: { select: { crew: true, allocations: true } } },
    }),
  ]);
  return {
    rows: rows.map((p) => ({ ...toProjectDto(p), clientName: p.client?.name ?? null, crewCount: p._count.crew, reservationCount: p._count.allocations })),
    total,
    page: filters.page,
    pages: Math.max(1, Math.ceil(total / PAGE)),
    closeMatches,
  };
}

/* Project detail */

export type ReservationRow = {
  id: string;
  modelId: string;
  modelLabel: string;
  trackingType: string;
  quantity: number;
  startDate: DateString;
  endDate: DateString;
  note: string | null;
  itemId: string | null;
  itemTag: string | null;
  pricePerDay: number | null;
  discountPct: number | null;
  /** Availability check for this reservation against everything else. */
  available: number;
  shortfall: number;
  conflicts: AllocationLike[];
};

export async function projectDetail(id: string) {
  const p = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      contacts: { orderBy: { name: "asc" } },
      crew: { include: { user: { select: { id: true, name: true, email: true, phone: true } } }, orderBy: { user: { name: "asc" } } },
      allocations: { include: { model: { select: { id: true, manufacturer: true, name: true, variant: true, trackingType: true } }, item: { select: { assetTag: true } } }, orderBy: [{ startDate: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!p) return null;

  const reservations: ReservationRow[] = [];
  for (const a of p.allocations) {
    const [items, allocs] = await Promise.all([itemsForModel(a.modelId), allocationsFor(a.modelId)]);
    const check = checkRequest(items, allocs, { from: dateToString(a.startDate), to: dateToString(a.endDate) }, a.quantity, { allocationId: a.id });
    reservations.push({
      id: a.id,
      modelId: a.modelId,
      modelLabel: `${modelLabel(a.model)}`,
      trackingType: a.model.trackingType,
      quantity: a.quantity,
      startDate: dateToString(a.startDate),
      endDate: dateToString(a.endDate),
      note: a.note,
      itemId: a.itemId,
      itemTag: a.item?.assetTag ?? null,
      pricePerDay: a.pricePerDay === null ? null : a.pricePerDay.toNumber(),
      discountPct: a.discountPct === null ? null : a.discountPct.toNumber(),
      available: check.available,
      shortfall: check.shortfall,
      conflicts: check.conflicts,
    });
  }

  const location = await prisma.location.findFirst({ where: { projectId: id }, include: { _count: { select: { items: true } } } });

  return {
    project: toProjectDto(p),
    client: p.client,
    contacts: p.contacts,
    crew: p.crew.map((c) => ({ id: c.id, userId: c.userId, name: c.user.name, email: c.user.email, phone: c.user.phone, role: c.role, callTime: c.callTime, notes: c.notes })),
    reservations,
    itemsOnSite: location?._count.items ?? 0,
    locationId: location?.id ?? null,
    activity: await activityFor("project", id, 30),
  };
}

/* Per-model availability (model page + API) */

export async function modelAvailabilityView(modelId: string, from?: DateString, to?: DateString) {
  const [items, allocs] = await Promise.all([itemsForModel(modelId), allocationsFor(modelId)]);
  const t = today();
  const window = { from: from ?? t, to: to ?? addDays(t, 30) };
  const check = checkRequest(items, allocs, window, 0);
  const upcoming = allocs.filter((a) => a.endDate >= t).sort((a, b) => a.startDate.localeCompare(b.startDate));
  return { window, ...check, upcoming, overbooked: overbookedDays(items, allocs, window) };
}

/* Timeline (calendar page) */

export type TimelineBar = {
  kind: "project" | "rental";
  id: string;
  label: string;
  sub: string | null;
  status: string;
  from: DateString;
  to: DateString;
  href: string;
};

/** Projects and rentals in a window as timeline bars (no conflict check: cheap enough for a year). */
export async function timelineBars(from: DateString, to: DateString): Promise<TimelineBar[]> {
  const [projects, rentals] = await Promise.all([
    prisma.project.findMany({
      where: { reserveFrom: { lte: new Date(`${to}T00:00:00Z`) }, reserveTo: { gte: new Date(`${from}T00:00:00Z`) }, status: { not: "cancelled" } },
      include: { client: { select: { name: true } } },
      orderBy: { reserveFrom: "asc" },
    }),
    prisma.rental.findMany({
      where: { startDate: { lte: new Date(`${to}T00:00:00Z`) }, endDate: { gte: new Date(`${from}T00:00:00Z`) } },
      include: { client: { select: { name: true } } },
      orderBy: { startDate: "asc" },
    }),
  ]);
  const bars: TimelineBar[] = [
    ...projects.map((p) => ({
      kind: "project" as const,
      id: p.id,
      label: p.name,
      sub: p.client?.name ?? p.venueName,
      status: p.status,
      from: dateToString(p.reserveFrom!),
      to: dateToString(p.reserveTo!),
      href: `/projects/${p.id}`,
    })),
    ...rentals.map((r) => ({
      kind: "rental" as const,
      id: r.id,
      label: r.client.name,
      sub: null,
      status: r.status,
      from: dateToString(r.startDate),
      to: dateToString(r.endDate),
      href: `/rentals/${r.id}`,
    })),
  ];
  return bars;
}

export async function timeline(from: DateString, to: DateString) {
  const bars = await timelineBars(from, to);

  // Over-booked models in the window.
  const modelIds = [...new Set((await prisma.allocation.findMany({ where: { startDate: { lte: new Date(`${to}T00:00:00Z`) }, endDate: { gte: new Date(`${from}T00:00:00Z`) } }, select: { modelId: true } })).map((a) => a.modelId))];
  const conflicts: { modelId: string; modelLabel: string; days: { day: DateString; shortfall: number }[]; holders: string[] }[] = [];
  for (const modelId of modelIds) {
    const [items, allocs, model] = await Promise.all([itemsForModel(modelId), allocationsFor(modelId), prisma.model.findUnique({ where: { id: modelId }, select: { manufacturer: true, name: true, variant: true } })]);
    const days = overbookedDays(items, allocs, { from, to });
    if (days.length && model) {
      const holders = [...new Set(allocs.filter((a) => days.some((d) => a.startDate <= d.day && a.endDate >= d.day)).map((a) => a.holderName))];
      conflicts.push({ modelId, modelLabel: `${modelLabel(model)}`, days, holders });
    }
  }
  return { bars, conflicts };
}

/* Dashboard */

export async function upcomingProjects(limit = 6) {
  const t = new Date(`${today()}T00:00:00Z`);
  const rows = await prisma.project.findMany({
    where: { status: { in: PROJECT_STATUSES.filter((s) => s.key !== "done" && s.key !== "cancelled").map((s) => s.key) }, OR: [{ reserveTo: { gte: t } }, { reserveTo: null }] },
    orderBy: [{ reserveFrom: "asc" }],
    take: limit,
    include: { client: { select: { name: true } } },
  });
  return rows.map((p) => ({ ...toProjectDto(p), clientName: p.client?.name ?? null }));
}
