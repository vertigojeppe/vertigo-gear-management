import { appConfig } from "../../config/app.config";

const tz = appConfig.timezone;

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00Z" : d) : d;
  return new Intl.DateTimeFormat("da-DK", { timeZone: d instanceof Date || d.length > 10 ? tz : "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

/** A day range: "12.09.2026", or "12.09.2026 – 14.09.2026" when it runs over several days. */
export function formatDayRange(from: Date | string | null | undefined, to?: Date | string | null): string {
  if (!from) return "";
  const a = formatDate(from);
  const b = to ? formatDate(to) : a;
  return b === a ? a : `${a} – ${b}`;
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatMoney(n: number | null | undefined, currency: string = appConfig.currency): string {
  if (n === null || n === undefined) return "";
  return new Intl.NumberFormat("da-DK", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

/** "Robe Pointe", "DMX 5-pin 5 m": manufacturer (if any), family name and variant (if any). */
export function modelLabel(m: { manufacturer?: string | null; name: string; variant?: string | null }): string {
  return [m.manufacturer?.trim(), m.name, m.variant?.trim()].filter(Boolean).join(" ");
}

/** The family without its variant: "DMX 5-pin", "Robe Pointe". */
export function familyLabel(m: { manufacturer?: string | null; name: string }): string {
  return [m.manufacturer?.trim(), m.name].filter(Boolean).join(" ");
}

export function formatNumber(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return "";
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: digits }).format(n);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
