import { appConfig } from "../../config/app.config";

/**
 * Date helpers. Conventions:
 * - "date" values (YYYY-MM-DD strings, Prisma @db.Date) are calendar days
 *   in Europe/Copenhagen, stored as UTC midnight.
 * - "datetime" values are instants; forms edit them as Copenhagen wall-clock
 *   via <input type="datetime-local">.
 */
const TZ = appConfig.timezone;

export type DateString = string; // YYYY-MM-DD

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Date (UTC midnight) from a YYYY-MM-DD string. */
export function dateFromString(s: DateString): Date {
  if (!ISO_DATE.test(s)) throw new Error(`Not a date: ${s}`);
  return new Date(`${s}T00:00:00Z`);
}

/** YYYY-MM-DD from a Prisma @db.Date value (UTC midnight). */
export function dateToString(d: Date): DateString {
  return d.toISOString().slice(0, 10);
}

/** Calendar day in Copenhagen for an instant. */
export function dayInZone(d: Date): DateString {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function today(): DateString {
  return dayInZone(new Date());
}

export function addDays(s: DateString, n: number): DateString {
  const d = dateFromString(s);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToString(d);
}

/** Inclusive day count between two dates (same day = 1). */
export function daysBetween(from: DateString, to: DateString): number {
  return Math.round((dateFromString(to).getTime() - dateFromString(from).getTime()) / 86_400_000) + 1;
}

export function minDate(...ds: (DateString | null | undefined)[]): DateString | null {
  const list = ds.filter((d): d is DateString => Boolean(d));
  return list.length ? list.reduce((a, b) => (a < b ? a : b)) : null;
}

export function maxDate(...ds: (DateString | null | undefined)[]): DateString | null {
  const list = ds.filter((d): d is DateString => Boolean(d));
  return list.length ? list.reduce((a, b) => (a > b ? a : b)) : null;
}

/** Day of the week, Monday = 1 … Sunday = 7. */
export function isoWeekday(s: DateString): number {
  return new Date(`${s}T00:00:00Z`).getUTCDay() || 7;
}

/** ISO 8601 week number (the one Danish calendars use): weeks start on Monday, week 1 holds the year's first Thursday. */
export function isoWeek(s: DateString): number {
  const thursday = addDays(s, 4 - isoWeekday(s));
  const jan1 = `${thursday.slice(0, 4)}-01-01`;
  return Math.floor((daysBetween(jan1, thursday) - 1) / 7) + 1;
}

/** Two inclusive date ranges overlap. */
export function rangesOverlap(aFrom: DateString, aTo: DateString, bFrom: DateString, bTo: DateString): boolean {
  return aFrom <= bTo && aTo >= bFrom;
}

/* ---- datetime-local <-> UTC in Copenhagen ------------------------------ */

function zoneOffsetMinutes(utc: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asIfUtc - utc.getTime()) / 60_000);
}

/** "YYYY-MM-DDTHH:mm" (Copenhagen wall clock) → instant. */
export function zonedInputToDate(input: string): Date {
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) throw new Error(`Not a datetime: ${input}`);
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Two passes handle DST edges well enough for scheduling purposes.
  let offset = zoneOffsetMinutes(new Date(guess));
  let result = guess - offset * 60_000;
  offset = zoneOffsetMinutes(new Date(result));
  result = guess - offset * 60_000;
  return new Date(result);
}

/** instant → "YYYY-MM-DDTHH:mm" in Copenhagen, for datetime-local inputs. */
export function dateToZonedInput(d: Date | null | undefined): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}
