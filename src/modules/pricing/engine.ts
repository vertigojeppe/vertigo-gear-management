import type { RateExtraRule } from "../../../config/app.config";

/**
 * Pure pricing engine. A quote has gear lines (day price × rate factor ×
 * quantity, less a line discount), extra lines (fixed amounts: freight,
 * insurance, crew), a document discount, and VAT on top. Nothing here
 * touches the database; the service builds the inputs.
 */

export type RateTier = { days: number; factor: number };
export type RateTableLike = { tiers: RateTier[]; extraRule: RateExtraRule; extraFactor: number };

/**
 * Factor for a number of charge days: the nearest lower tier (step
 * function). Below the first tier the first tier applies. Beyond the last
 * tier the table's extra rule adds `extraFactor` per further day or per
 * started block of 10 days; with no rule the last tier holds.
 */
export function factorFor(table: RateTableLike, days: number): number {
  const tiers = [...table.tiers].sort((a, b) => a.days - b.days);
  if (tiers.length === 0) return 1;
  const d = Math.max(1, Math.floor(days));
  if (d <= tiers[0].days) return tiers[0].factor;
  const last = tiers[tiers.length - 1];
  if (d > last.days) {
    const over = d - last.days;
    if (table.extraRule === "per_day") return round3(last.factor + table.extraFactor * over);
    if (table.extraRule === "per_10_days") return round3(last.factor + table.extraFactor * Math.ceil(over / 10));
    return last.factor;
  }
  let current = tiers[0];
  for (const t of tiers) {
    if (t.days <= d) current = t;
    else break;
  }
  return current.factor;
}

export type GearLineInput = { quantity: number; dayPrice: number | null; discountPct: number | null };
export type ExtraLineInput = { quantity: number; unitPrice: number; discountPct: number | null };
export type LinePrice = { gross: number; discount: number; net: number };

/** gross = day price × factor × quantity; net after the line discount. */
export function gearLinePrice(line: GearLineInput, factor: number): LinePrice {
  const gross = round2((line.dayPrice ?? 0) * factor * line.quantity);
  return withDiscount(gross, line.discountPct);
}

/** A fixed line: unit price × quantity, less its discount. */
export function extraLinePrice(line: ExtraLineInput): LinePrice {
  return withDiscount(round2(line.unitPrice * line.quantity), line.discountPct);
}

function withDiscount(gross: number, pct: number | null): LinePrice {
  const discount = pct ? round2((gross * pct) / 100) : 0;
  return { gross, discount, net: round2(gross - discount) };
}

export type QuoteTotals = {
  days: number;
  factor: number;
  /** Sum of all line nets before the document discount. */
  linesTotal: number;
  documentDiscount: number;
  /** After the document discount, excl. VAT. */
  subtotal: number;
  vat: number;
  total: number;
};

export function quoteTotals(input: { days: number; table: RateTableLike; gearLines: GearLineInput[]; extraLines: ExtraLineInput[]; discountPct: number | null; vatRate: number }): QuoteTotals {
  const factor = factorFor(input.table, input.days);
  const linesTotal = round2(input.gearLines.reduce((s, l) => s + gearLinePrice(l, factor).net, 0) + input.extraLines.reduce((s, l) => s + extraLinePrice(l).net, 0));
  const documentDiscount = input.discountPct ? round2((linesTotal * input.discountPct) / 100) : 0;
  const subtotal = round2(linesTotal - documentDiscount);
  const vat = round2(subtotal * input.vatRate);
  return { days: input.days, factor, linesTotal, documentDiscount, subtotal, vat, total: round2(subtotal + vat) };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Parse a tiers editor: parallel `tierDays` / `tierFactor` values, blank rows dropped, days unique. */
export function parseTiers(days: string[], factors: string[]): { tiers: RateTier[]; error?: string } {
  const tiers: RateTier[] = [];
  for (let i = 0; i < Math.max(days.length, factors.length); i++) {
    const d = (days[i] ?? "").trim();
    const f = (factors[i] ?? "").trim().replace(",", ".");
    if (!d && !f) continue;
    const dn = Number(d);
    const fn = Number(f);
    if (!Number.isInteger(dn) || dn < 1) return { tiers: [], error: `Row ${i + 1}: days must be a whole number of at least 1.` };
    if (!Number.isFinite(fn) || fn < 0) return { tiers: [], error: `Row ${i + 1}: the factor must be a number.` };
    if (tiers.some((t) => t.days === dn)) return { tiers: [], error: `Row ${i + 1}: ${dn} days is listed twice.` };
    tiers.push({ days: dn, factor: fn });
  }
  if (tiers.length === 0) return { tiers: [], error: "Add at least one tier." };
  return { tiers: tiers.sort((a, b) => a.days - b.days) };
}
