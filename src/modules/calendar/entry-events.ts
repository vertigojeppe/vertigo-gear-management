import { addDays, dateToString } from "@/lib/dates";
import { appConfig } from "../../../config/app.config";
import type { GoogleEvent } from "./google";

/**
 * Where a calendar entry goes in Google, and how it reads there (pure).
 *
 * Invitations on (Settings › Calendar; needs domain-wide delegation): time
 * off goes into the person's own calendar; meetings and assignments are
 * created in the creator's calendar with the people and guests as
 * attendees, and Google emails the invitations. Invitations off, or nobody
 * to act as: the shared projects calendar, with the names in the title.
 */
export type GoogleEntry = {
  id: string;
  kind: string;
  title: string;
  notes: string | null;
  location: string | null;
  projectName: string | null;
  allDay: boolean;
  startsAt: Date;
  endsAt: Date;
  guests: string[];
  /** Google address: the user's googleEmail, else their sign-in email. */
  creator: { name: string; email: string } | null;
  people: { name: string; email: string }[];
};

export type GoogleTarget = { calendarId: string; subject?: string; sendUpdates: boolean; event: GoogleEvent };

export function entryGoogle(e: GoogleEntry, opts: { invites: boolean; sharedCalendarId: string; appUrl: (path: string) => string }): GoogleTarget {
  const link = opts.appUrl(`/calendar/entries/${e.id}`);
  const names = e.people.map((p) => p.name).join(", ");
  const description = [e.notes, e.projectName ? `Job: ${e.projectName}` : null, names ? `People: ${names}` : null, link].filter(Boolean).join("\n");
  const when = e.allDay
    ? { start: { date: dateToString(e.startsAt) }, end: { date: addDays(dateToString(e.endsAt), 1) } }
    : { start: { dateTime: e.startsAt.toISOString(), timeZone: appConfig.timezone }, end: { dateTime: e.endsAt.toISOString(), timeZone: appConfig.timezone } };
  const base = { description, location: e.location ?? undefined, source: { title: "Vertigo Gear", url: link }, ...when };
  const offTitle = e.title === "Off" ? "" : ` (${e.title})`;

  const owner = e.kind === "time_off" ? e.people[0] : e.creator;
  if (opts.invites && owner) {
    const attendees = e.kind === "time_off" ? [] : [...new Set([...e.people.map((p) => p.email), ...e.guests].map((a) => a.toLowerCase()))].filter((a) => a !== owner.email.toLowerCase()).map((email) => ({ email }));
    return {
      calendarId: "primary",
      subject: owner.email,
      sendUpdates: attendees.length > 0,
      event: { ...base, summary: e.kind === "time_off" ? `Off${offTitle}` : e.title, attendees: attendees.length ? attendees : undefined },
    };
  }
  const summary = e.kind === "time_off" ? `Off: ${names || "?"}${offTitle}` : e.kind === "assignment" && names ? `${e.title} (${names})` : e.title;
  return { calendarId: opts.sharedCalendarId, sendUpdates: false, event: { ...base, summary } };
}
