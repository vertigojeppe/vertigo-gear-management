import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { activityFor } from "@/lib/activity";
import { dateToString, today } from "@/lib/dates";
import { appConfig } from "../../../config/app.config";
import { checkRequest } from "@/modules/projects";
import { allocationsFor, itemsForModel } from "@/modules/projects";
import { lineTotal } from "./pricing";
import type { RentalFilters } from "./schema";
import { rentalTotals, toRentalDto, type RentalDto, type RentalLineDto } from "./service";

const PAGE = appConfig.pageSize;
const num = (v: { toNumber(): number } | null) => (v === null ? null : v.toNumber());

export type RentalListRow = RentalDto & { clientName: string; lineCount: number; total: number };

export async function listRentals(filters: RentalFilters): Promise<{ rows: RentalListRow[]; total: number; page: number; pages: number }> {
  const where: Prisma.RentalWhereInput = {};
  if (filters.q) where.OR = [{ client: { name: { contains: filters.q, mode: "insensitive" } } }, { notes: { contains: filters.q, mode: "insensitive" } }];
  if (filters.status === "overdue") {
    where.status = "out";
    where.endDate = { lt: new Date(`${today()}T00:00:00Z`) };
  } else if (filters.status) where.status = filters.status;

  const [total, rows] = await Promise.all([
    prisma.rental.count({ where }),
    prisma.rental.findMany({
      where,
      orderBy: [{ startDate: "desc" }],
      skip: (filters.page - 1) * PAGE,
      take: PAGE,
      include: { client: { select: { name: true } }, lines: true },
    }),
  ]);
  return {
    rows: rows.map((r) => {
      const dto = toRentalDto(r);
      const lines = r.lines.map((l) => ({ quantity: l.quantity, pricePerDay: num(l.pricePerDay), pricePerWeek: num(l.pricePerWeek) }));
      return { ...dto, clientName: r.client.name, lineCount: r.lines.length, total: rentalTotals(lines, dto.startDate, dto.endDate).subtotal };
    }),
    total,
    page: filters.page,
    pages: Math.max(1, Math.ceil(total / PAGE)),
  };
}

export async function rentalDetail(id: string) {
  const r = await prisma.rental.findUnique({
    where: { id },
    include: {
      client: true,
      lines: { include: { model: { select: { id: true, manufacturer: true, name: true, trackingType: true } }, item: { select: { id: true, assetTag: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!r) return null;
  const dto = toRentalDto(r);
  const lines: (RentalLineDto & { available: number; shortfall: number; conflicts: string[] })[] = [];
  for (const l of r.lines) {
    const [items, allocs] = await Promise.all([itemsForModel(l.modelId), allocationsFor(l.modelId)]);
    const alloc = allocs.find((a) => a.holderType === "rental" && a.holderId === id && a.modelId === l.modelId);
    const check = checkRequest(items, allocs, { from: dto.startDate, to: dto.endDate }, l.quantity, alloc ? { allocationId: alloc.id } : undefined);
    const price = { quantity: l.quantity, pricePerDay: num(l.pricePerDay), pricePerWeek: num(l.pricePerWeek) };
    lines.push({
      id: l.id,
      modelId: l.modelId,
      modelLabel: `${l.model.manufacturer} ${l.model.name}`,
      trackingType: l.model.trackingType,
      quantity: l.quantity,
      pricePerDay: price.pricePerDay,
      pricePerWeek: price.pricePerWeek,
      itemId: l.itemId,
      itemTag: l.item?.assetTag ?? null,
      note: l.note,
      lineTotal: lineTotal(price, dto.startDate, dto.endDate),
      available: check.available,
      shortfall: check.shortfall,
      conflicts: [...new Set(check.conflicts.map((c) => c.holderName))],
    });
  }
  return {
    rental: dto,
    client: r.client,
    lines,
    totals: rentalTotals(lines, dto.startDate, dto.endDate),
    activity: await activityFor("rental", id, 30),
  };
}

/** Serialized units of a model that are free for a rental's window (for the assign dropdown). */
export async function assignableUnits(modelId: string, rentalId: string) {
  const r = await prisma.rental.findUniqueOrThrow({ where: { id: rentalId } });
  const units = await prisma.item.findMany({ where: { modelId, status: { notIn: ["retired", "missing"] }, isKit: false }, orderBy: { assetTag: "asc" }, select: { id: true, assetTag: true, serialNumber: true, status: true } });
  const taken = await prisma.allocation.findMany({
    where: { modelId, itemId: { not: null }, rentalId: { not: rentalId }, startDate: { lte: r.endDate }, endDate: { gte: r.startDate }, OR: [{ project: { status: { notIn: ["done", "cancelled"] } } }, { rental: { status: { not: "returned" } } }] },
    select: { itemId: true },
  });
  const takenIds = new Set(taken.map((t) => t.itemId));
  return units.filter((u) => !takenIds.has(u.id)).map((u) => ({ id: u.id, label: `${u.assetTag}${u.serialNumber ? ` · SN ${u.serialNumber}` : ""} · ${u.status}` }));
}

export async function overdueRentals() {
  const rows = await prisma.rental.findMany({ where: { status: "out", endDate: { lt: new Date(`${today()}T00:00:00Z`) } }, include: { client: { select: { name: true } } }, orderBy: { endDate: "asc" } });
  return rows.map((r) => ({ id: r.id, clientName: r.client.name, endDate: dateToString(r.endDate) }));
}
