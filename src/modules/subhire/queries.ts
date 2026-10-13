import { prisma } from "@/lib/db";
import { dateToString, type DateString } from "@/lib/dates";
import { modelLabel } from "@/lib/format";
import type { Link } from "./schema";

const num = (v: { toNumber(): number } | null): number | null => (v === null ? null : v.toNumber());

export type SubHireItemRow = {
  id: string;
  ownerContactId: string;
  ownerName: string;
  manufacturer: string;
  name: string;
  variant: string | null;
  label: string;
  categoryId: string | null;
  categoryName: string | null;
  description: string | null;
  costPerDay: number | null;
  rentalDayPrice: number | null;
  links: Link[];
  notes: string | null;
  archived: boolean;
  /** Project lines that use it (so delete can refuse). */
  lines: number;
};

export type SubHireOwnerGroup = { ownerContactId: string; ownerName: string; items: SubHireItemRow[] };

/** The catalog grouped by owner, active items unless asked for the archived ones too. */
export async function subHireCatalog(includeArchived = false): Promise<SubHireOwnerGroup[]> {
  const rows = await prisma.subHireItem.findMany({
    where: includeArchived ? undefined : { archived: false },
    orderBy: [{ owner: { name: "asc" } }, { manufacturer: "asc" }, { name: "asc" }, { variant: "asc" }],
    include: { owner: { select: { name: true, organisation: true } }, category: { select: { name: true } }, _count: { select: { lines: true } } },
  });
  const groups = new Map<string, SubHireOwnerGroup>();
  for (const r of rows) {
    const ownerName = r.owner.organisation ? `${r.owner.name} (${r.owner.organisation})` : r.owner.name;
    const g = groups.get(r.ownerContactId) ?? { ownerContactId: r.ownerContactId, ownerName, items: [] };
    g.items.push({
      id: r.id,
      ownerContactId: r.ownerContactId,
      ownerName,
      manufacturer: r.manufacturer,
      name: r.name,
      variant: r.variant,
      label: modelLabel(r),
      categoryId: r.categoryId,
      categoryName: r.category?.name ?? null,
      description: r.description,
      costPerDay: num(r.costPerDay),
      rentalDayPrice: num(r.rentalDayPrice),
      links: (r.links as Link[]) ?? [],
      notes: r.notes,
      archived: r.archived,
      lines: r._count.lines,
    });
    groups.set(r.ownerContactId, g);
  }
  return [...groups.values()];
}

export type SubHireOption = { id: string; label: string; ownerName: string; costPerDay: number | null; rentalDayPrice: number | null };

/** Active items for the "rent in" select. */
export async function subHireOptions(): Promise<SubHireOption[]> {
  const rows = await prisma.subHireItem.findMany({ where: { archived: false }, orderBy: [{ owner: { name: "asc" } }, { manufacturer: "asc" }, { name: "asc" }, { variant: "asc" }], include: { owner: { select: { name: true } } } });
  return rows.map((r) => ({ id: r.id, label: modelLabel(r), ownerName: r.owner.name, costPerDay: num(r.costPerDay), rentalDayPrice: num(r.rentalDayPrice) }));
}

export type SubHireLineRow = {
  id: string;
  subHireItemId: string;
  label: string;
  ownerName: string;
  quantity: number;
  startDate: DateString;
  endDate: DateString;
  costPerDay: number | null;
  pricePerDay: number | null;
  discountPct: number | null;
  note: string | null;
};

/** What a project rents in, oldest line first. */
export async function subHireLinesFor(projectId: string): Promise<SubHireLineRow[]> {
  const rows = await prisma.subHireLine.findMany({ where: { projectId }, orderBy: [{ startDate: "asc" }, { createdAt: "asc" }], include: { item: { include: { owner: { select: { name: true } } } } } });
  return rows.map((l) => ({
    id: l.id,
    subHireItemId: l.subHireItemId,
    label: modelLabel(l.item),
    ownerName: l.item.owner.name,
    quantity: l.quantity,
    startDate: dateToString(l.startDate),
    endDate: dateToString(l.endDate),
    costPerDay: num(l.costPerDay),
    pricePerDay: num(l.pricePerDay),
    discountPct: num(l.discountPct),
    note: l.note,
  }));
}
