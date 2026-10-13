import { prisma } from "@/lib/db";
import { dateToString, daysBetween, type DateString } from "@/lib/dates";
import { appConfig } from "../../../config/app.config";
import { extraLinePrice, gearLinePrice, quoteTotals, type LinePrice, type QuoteTotals } from "./engine";
import { rateTables, toRateTableDto, type HolderKind, type RateTableDto } from "./service";
import { modelLabel } from "@/lib/format";

const num = (v: { toNumber(): number } | number | null | undefined): number | null => (v === null || v === undefined ? null : typeof v === "number" ? v : v.toNumber());

export type QuoteGearLine = {
  id: string;
  modelId: string;
  label: string;
  quantity: number;
  dayPrice: number | null;
  /** The model's current list day price, to show when the line differs. */
  listDayPrice: number | null;
  discountPct: number | null;
  note: string | null;
  itemTag: string | null;
} & LinePrice;

export type QuoteExtraLine = { id: string; description: string; quantity: number; unitPrice: number; discountPct: number | null } & LinePrice;

export type Quote = {
  holder: { kind: HolderKind; id: string; title: string; reference: string; status: string };
  client: { name: string; contactName: string | null; email: string | null; phone: string | null; address: string | null } | null;
  /** The window the gear is booked for, when known. */
  window: { from: DateString; to: DateString } | null;
  /** Days the window spans (what chargeDays defaults to). */
  windowDays: number | null;
  chargeDays: number;
  chargeDaysOverridden: boolean;
  rateTable: RateTableDto | null;
  rateTableOverridden: boolean;
  discountPct: number | null;
  terms: string | null;
  deposit: number | null;
  notes: string | null;
  gearLines: QuoteGearLine[];
  extraLines: QuoteExtraLine[];
  totals: QuoteTotals;
  vatRate: number;
};

/**
 * The priced view of a project (its reservations) or a rental (its lines),
 * plus extra lines and totals. Everything the quote section, the list
 * totals and the PDF need, computed in one place.
 */
export async function quoteFor(kind: HolderKind, id: string): Promise<Quote | null> {
  if (kind === "project") {
    const p = await prisma.project.findUnique({
      where: { id },
      include: { client: true, rateTable: { include: { tiers: true } }, extraLines: { orderBy: { sortOrder: "asc" } }, allocations: { include: { model: { select: { manufacturer: true, name: true, variant: true, rentalDayPrice: true } }, item: { select: { assetTag: true } } }, orderBy: [{ startDate: "asc" }, { createdAt: "asc" }] } },
    });
    if (!p) return null;
    const window = p.reserveFrom && p.reserveTo ? { from: dateToString(p.reserveFrom), to: dateToString(p.reserveTo) } : null;
    return build({
      holder: { kind, id, title: p.name, reference: `P-${p.id.slice(-6).toUpperCase()}`, status: p.status },
      client: p.client,
      window,
      chargeDays: p.chargeDays,
      table: p.rateTable ? toRateTableDto(p.rateTable) : null,
      discountPct: num(p.discountPct),
      terms: p.terms,
      deposit: null,
      notes: null,
      gear: p.allocations.map((a) => ({ id: a.id, modelId: a.modelId, label: `${modelLabel(a.model)}`, quantity: a.quantity, dayPrice: num(a.pricePerDay), listDayPrice: num(a.model.rentalDayPrice), discountPct: num(a.discountPct), note: a.note, itemTag: a.item?.assetTag ?? null })),
      extra: p.extraLines,
    });
  }
  const r = await prisma.rental.findUnique({
    where: { id },
    include: { client: true, rateTable: { include: { tiers: true } }, extraLines: { orderBy: { sortOrder: "asc" } }, lines: { include: { model: { select: { manufacturer: true, name: true, variant: true, rentalDayPrice: true } }, item: { select: { assetTag: true } } }, orderBy: { createdAt: "asc" } } },
  });
  if (!r) return null;
  return build({
    holder: { kind, id, title: r.client.name, reference: `R-${r.id.slice(-6).toUpperCase()}`, status: r.status },
    client: r.client,
    window: { from: dateToString(r.startDate), to: dateToString(r.endDate) },
    chargeDays: r.chargeDays,
    table: r.rateTable ? toRateTableDto(r.rateTable) : null,
    discountPct: num(r.discountPct),
    terms: r.terms,
    deposit: num(r.deposit),
    notes: r.notes,
    gear: r.lines.map((l) => ({ id: l.id, modelId: l.modelId, label: `${modelLabel(l.model)}`, quantity: l.quantity, dayPrice: num(l.pricePerDay), listDayPrice: num(l.model.rentalDayPrice), discountPct: num(l.discountPct), note: l.note, itemTag: l.item?.assetTag ?? null })),
    extra: r.extraLines,
  });
}

type GearIn = Omit<QuoteGearLine, keyof LinePrice>;
type ExtraRow = { id: string; description: string; quantity: number; unitPrice: { toNumber(): number }; discountPct: { toNumber(): number } | null };

async function build(x: {
  holder: Quote["holder"];
  client: Quote["client"];
  window: Quote["window"];
  chargeDays: number | null;
  table: RateTableDto | null;
  discountPct: number | null;
  terms: string | null;
  deposit: number | null;
  notes: string | null;
  gear: GearIn[];
  extra: ExtraRow[];
}): Promise<Quote> {
  const table = x.table ?? (await rateTables.fallback());
  const windowDays = x.window ? daysBetween(x.window.from, x.window.to) : null;
  const chargeDays = x.chargeDays ?? windowDays ?? 1;
  const engineTable = table ?? { tiers: [], extraRule: "none" as const, extraFactor: 0 };
  const totals = quoteTotals({
    days: chargeDays,
    table: engineTable,
    gearLines: x.gear.map((g) => ({ quantity: g.quantity, dayPrice: g.dayPrice, discountPct: g.discountPct })),
    extraLines: x.extra.map((e) => ({ quantity: e.quantity, unitPrice: e.unitPrice.toNumber(), discountPct: num(e.discountPct) })),
    discountPct: x.discountPct,
    vatRate: appConfig.vatRate,
  });
  return {
    holder: x.holder,
    client: x.client ? { name: x.client.name, contactName: x.client.contactName, email: x.client.email, phone: x.client.phone, address: x.client.address } : null,
    window: x.window,
    windowDays,
    chargeDays,
    chargeDaysOverridden: x.chargeDays !== null,
    rateTable: table,
    rateTableOverridden: x.table !== null,
    discountPct: x.discountPct,
    terms: x.terms,
    deposit: x.deposit,
    notes: x.notes,
    gearLines: x.gear.map((g) => ({ ...g, ...gearLinePrice({ quantity: g.quantity, dayPrice: g.dayPrice, discountPct: g.discountPct }, totals.factor) })),
    extraLines: x.extra.map((e) => {
      const line = { quantity: e.quantity, unitPrice: e.unitPrice.toNumber(), discountPct: num(e.discountPct) };
      return { id: e.id, description: e.description, ...line, ...extraLinePrice(line) };
    }),
    totals,
    vatRate: appConfig.vatRate,
  };
}

/** Rate tables for a select: id, name, default flag. */
export async function rateTableOptions() {
  return (await rateTables.list()).map((t) => ({ id: t.id, name: t.name, isDefault: t.isDefault }));
}

/** Subtotals of many rentals at once (list page), with the tables loaded once. */
export async function rentalSubtotals(rentals: { id: string; startDate: Date; endDate: Date; chargeDays: number | null; rateTableId: string | null; discountPct: { toNumber(): number } | null; lines: { quantity: number; pricePerDay: { toNumber(): number } | null; discountPct: { toNumber(): number } | null }[]; extraLines: ExtraRow[] }[]): Promise<Map<string, number>> {
  const tables = new Map((await rateTables.list()).map((t) => [t.id, t]));
  const fallback = [...tables.values()].find((t) => t.isDefault) ?? [...tables.values()][0] ?? null;
  const out = new Map<string, number>();
  for (const r of rentals) {
    const table = (r.rateTableId ? tables.get(r.rateTableId) : null) ?? fallback ?? { tiers: [], extraRule: "none" as const, extraFactor: 0 };
    const days = r.chargeDays ?? daysBetween(dateToString(r.startDate), dateToString(r.endDate));
    const t = quoteTotals({
      days,
      table,
      gearLines: r.lines.map((l) => ({ quantity: l.quantity, dayPrice: num(l.pricePerDay), discountPct: num(l.discountPct) })),
      extraLines: r.extraLines.map((e) => ({ quantity: e.quantity, unitPrice: e.unitPrice.toNumber(), discountPct: num(e.discountPct) })),
      discountPct: num(r.discountPct),
      vatRate: appConfig.vatRate,
    });
    out.set(r.id, t.subtotal);
  }
  return out;
}
