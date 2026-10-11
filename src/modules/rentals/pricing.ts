import { daysBetween, type DateString } from "@/lib/dates";

/**
 * Pure rental pricing. Per line: whole weeks at the weekly price plus
 * remaining days at the daily price. A line with only a daily price is
 * days × day. A line with only a weekly price charges a started week.
 */
export type PriceLine = { quantity: number; pricePerDay: number | null; pricePerWeek: number | null };

export function lineTotal(line: PriceLine, from: DateString, to: DateString): number {
  const days = daysBetween(from, to);
  const unit = unitPriceForDays(line, days);
  return round2(unit * line.quantity);
}

export function unitPriceForDays(line: PriceLine, days: number): number {
  const day = line.pricePerDay ?? null;
  const week = line.pricePerWeek ?? null;
  if (day === null && week === null) return 0;
  if (week === null) return day! * days;
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  if (day === null) return week * (weeks + (rest > 0 ? 1 : 0));
  // Never charge more for the remainder than a whole extra week.
  return week * weeks + Math.min(rest * day, week);
}

export function totals(lines: PriceLine[], from: DateString, to: DateString, vatRate: number) {
  const subtotal = round2(lines.reduce((s, l) => s + lineTotal(l, from, to), 0));
  const vat = round2(subtotal * vatRate);
  return { days: daysBetween(from, to), subtotal, vat, total: round2(subtotal + vat) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
