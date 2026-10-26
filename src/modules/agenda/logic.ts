import { addDays, dateFromString, dateToString, type DateString, zonedInputToDate } from "@/lib/dates";
import { ENTRY_KINDS, type EntryKind } from "../../../config/app.config";

/**
 * Calendar entries (pure): when an entry starts and ends from what the form
 * posts, the default title, and the "add to Google Calendar" link.
 */

export class AgendaError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = "AgendaError";
  }
}

export const entryKind = (k: string): EntryKind => (ENTRY_KINDS.some((x) => x.key === k) ? (k as EntryKind) : "meeting");
export const alwaysAllDay = (kind: EntryKind) => ENTRY_KINDS.find((k) => k.key === kind)?.allDay ?? false;

/**
 * Start and end from the form. Whole days: the first and last day as UTC
 * midnight (inclusive). Timed: one Copenhagen day from–to (an hour when
 * there is no end time); an end before the start runs past midnight.
 */
export function entryTimes(input: { kind: EntryKind; allDay: boolean; fromDate: DateString; toDate?: DateString; startTime?: string; endTime?: string }): { allDay: boolean; startsAt: Date; endsAt: Date } {
  const allDay = alwaysAllDay(input.kind) || input.allDay || !input.startTime;
  if (allDay) {
    const last = input.toDate ?? input.fromDate;
    if (last < input.fromDate) throw new AgendaError("The last day is before the first.", "toDate");
    return { allDay: true, startsAt: dateFromString(input.fromDate), endsAt: dateFromString(last) };
  }
  const startsAt = zonedInputToDate(`${input.fromDate}T${input.startTime}`);
  if (!input.endTime) return { allDay: false, startsAt, endsAt: new Date(startsAt.getTime() + 3600_000) };
  let endsAt = zonedInputToDate(`${input.fromDate}T${input.endTime}`);
  if (endsAt <= startsAt) endsAt = zonedInputToDate(`${addDays(input.fromDate, 1)}T${input.endTime}`);
  return { allDay: false, startsAt, endsAt };
}

/** "Off" for time off without a title; otherwise the title is required. */
export function entryTitle(kind: EntryKind, title: string | undefined): string {
  const t = title?.trim();
  if (t) return t;
  if (kind === "time_off") return "Off";
  throw new AgendaError("Give it a title.", "title");
}

/** Guests from the form: addresses separated by commas, semicolons, spaces or lines; invalid ones are reported. */
export function parseGuests(text: string | undefined): string[] {
  if (!text?.trim()) return [];
  const list = text.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const bad = list.filter((s) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
  if (bad.length) throw new AgendaError(`Not an email address: ${bad.join(", ")}.`, "guestsText");
  return [...new Set(list)];
}

/** The days an entry covers (inclusive), as Copenhagen days. */
export function entryDays(e: { allDay: boolean; startsAt: Date; endsAt: Date }, dayOf: (d: Date) => DateString): { from: DateString; to: DateString } {
  return e.allDay ? { from: dateToString(e.startsAt), to: dateToString(e.endsAt) } : { from: dayOf(e.startsAt), to: dayOf(e.endsAt) };
}

const gcalStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** A link that opens Google Calendar with the entry filled in, for people outside the app's invitations. */
export function googleTemplateLink(e: { title: string; allDay: boolean; startsAt: Date; endsAt: Date; location: string | null; details: string }): string {
  const dates = e.allDay
    ? `${dateToString(e.startsAt).replace(/-/g, "")}/${addDays(dateToString(e.endsAt), 1).replace(/-/g, "")}`
    : `${gcalStamp(e.startsAt)}/${gcalStamp(e.endsAt)}`;
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates, details: e.details, ...(e.location ? { location: e.location } : {}) });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** What the edit form starts with for an existing entry (Copenhagen dates and times). */
export type EntryFormValues = { id?: string; kind: EntryKind; title: string; projectId: string; allDay: boolean; fromDate: string; toDate: string; startTime: string; endTime: string; location: string; notes: string; guestsText: string; people: string[] };

export function entryFormValues(e: { id: string; kind: EntryKind; title: string; projectId: string | null; allDay: boolean; startsAt: Date; endsAt: Date; location: string | null; notes: string | null; guests: string[]; people: { id: string }[] }, zoned: (d: Date) => string): EntryFormValues {
  const start = zoned(e.startsAt);
  const end = zoned(e.endsAt);
  return {
    id: e.id,
    kind: e.kind,
    title: e.kind === "time_off" && e.title === "Off" ? "" : e.title,
    projectId: e.projectId ?? "",
    allDay: e.allDay,
    fromDate: e.allDay ? dateToString(e.startsAt) : start.slice(0, 10),
    toDate: e.allDay ? dateToString(e.endsAt) : "",
    startTime: e.allDay ? "" : start.slice(11, 16),
    endTime: e.allDay ? "" : end.slice(11, 16),
    location: e.location ?? "",
    notes: e.notes ?? "",
    guestsText: e.guests.join(", "),
    people: e.people.map((p) => p.id),
  };
}
