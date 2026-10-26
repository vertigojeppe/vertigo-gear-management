import { prisma } from "@/lib/db";
import { dateToString, addDays } from "@/lib/dates";
import { appConfig } from "../../../config/app.config";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into the outbox worker and Vitest
import { appSettings } from "@/modules/settings/app-settings";
import { jobEvents, type JobDates } from "./job-events";
import { GoogleCalendar, GoogleDelegationError, googleConfig, type GoogleEvent } from "./google";
import { entryGoogle, type GoogleEntry, type GoogleTarget } from "./entry-events";
import { modelLabel } from "@/lib/format";

/**
 * One-way push of projects and rentals to shared Google calendars.
 * Idempotent: event ids are stored on the row (googleEventIds JSON) and
 * reused on later syncs. The app is the source of truth; nothing is read
 * back from Google.
 */
const TZ = appConfig.timezone;

function appUrl(path: string) {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

/**
 * The Google events for a project, keyed by what `googleEventIds` stores:
 * "job" (the all-day banner), "show", and "load_in:<day>" / "load_out:<day>"
 * for each build-up and pack-down day (see job-events.ts). Exported for tests.
 */
export function projectPhaseEvents(
  p: JobDates & {
    id: string;
    name: string;
    venueName: string | null;
    venueAddress: string | null;
    client: { name: string } | null;
    crew: { user: { googleEmail: string | null } }[];
  },
  opts: { callHours?: number } = {},
): Record<string, GoogleEvent> {
  const out: Record<string, GoogleEvent> = {};
  const attendees = p.crew.map((c) => c.user.googleEmail).filter((e): e is string => Boolean(e)).map((email) => ({ email }));
  const base = {
    location: [p.venueName, p.venueAddress].filter(Boolean).join(", ") || undefined,
    source: { title: "Vertigo Gear", url: appUrl(`/projects/${p.id}`) },
    attendees: attendees.length ? attendees : undefined,
  };
  const about = `${p.client?.name ?? "No client"}${p.venueName ? ` · ${p.venueName}` : ""}`;
  for (const ev of jobEvents(p, opts)) {
    if (ev.allDay) {
      // End is exclusive in Google: the day after the last one.
      out[ev.key] = { ...base, summary: p.name, description: `${about}\n${ev.lines.join("\n")}\n${appUrl(`/projects/${p.id}`)}`, start: { date: ev.firstDay }, end: { date: addDays(ev.lastDay, 1) } };
    } else {
      out[ev.key] = {
        ...base,
        summary: `${p.name} – ${ev.title}`,
        description: `${ev.title} · ${about}\n${appUrl(`/projects/${p.id}`)}`,
        start: { dateTime: ev.start.toISOString(), timeZone: TZ },
        end: { dateTime: ev.end.toISOString(), timeZone: TZ },
      };
    }
  }
  return out;
}

/** `deletedIds`: the event ids a deleted project handed to its job; used when the row is gone. */
export async function syncProject(projectId: string, client?: GoogleCalendar, deletedIds?: Record<string, string>): Promise<"skipped" | "synced" | "deleted"> {
  const cfg = googleConfig();
  if (!cfg) return "skipped";
  const google = client ?? new GoogleCalendar(cfg.account);
  const p = await prisma.project.findUnique({ where: { id: projectId }, include: { client: true, crew: { include: { user: true } } } });
  const ids: Record<string, string> = p ? (typeof p.googleEventIds === "object" && p.googleEventIds ? { ...(p.googleEventIds as Record<string, string>) } : {}) : { ...deletedIds };

  // Deleted or cancelled or back to quote: remove everything we created.
  if (!p || p.status === "cancelled" || p.status === "quote") {
    for (const id of Object.values(ids)) await google.delete(cfg.calendars.projects, id);
    if (p) await prisma.project.update({ where: { id: projectId }, data: { googleEventIds: {} } });
    return "deleted";
  }

  const events = projectPhaseEvents(p, { callHours: await appSettings.callHours() });
  const next: Record<string, string> = {};
  for (const [key, ev] of Object.entries(events)) next[key] = await google.upsert(cfg.calendars.projects, ids[key] ?? null, ev);
  // Whatever is stored but no longer wanted goes: a phase without dates, a day that moved, and the per-phase
  // all-day events (prep, load_in, load_out, return) from before the banner.
  for (const [key, id] of Object.entries(ids)) if (!(key in events)) await google.delete(cfg.calendars.projects, id);
  await prisma.project.update({ where: { id: projectId }, data: { googleEventIds: next } });
  return "synced";
}

/** Queue a sync for every project that is (or may still be) in Google, e.g. after the event length changed. */
export async function queueAllProjectSyncs(): Promise<number> {
  const projects = await prisma.project.findMany({ where: { status: { notIn: ["quote", "cancelled"] } }, select: { id: true } });
  const pending = await prisma.outbox.findMany({ where: { type: "calendar.sync_project", status: "pending" }, select: { payload: true } });
  const queued = new Set(pending.map((r) => (r.payload as { id?: string }).id));
  const rows = projects.filter((p) => !queued.has(p.id)).map((p) => ({ type: "calendar.sync_project", payload: { id: p.id, event: "calendar.resync" } }));
  if (rows.length) await prisma.outbox.createMany({ data: rows });
  return projects.length;
}

/** `deletedIds`: the event ids a deleted rental handed to its job; used when the row is gone. */
export async function syncRental(rentalId: string, client?: GoogleCalendar, deletedIds?: Record<string, string>): Promise<"skipped" | "synced" | "deleted"> {
  const cfg = googleConfig();
  if (!cfg || !cfg.calendars.rentals) return "skipped";
  const google = client ?? new GoogleCalendar(cfg.account);
  const r = await prisma.rental.findUnique({ where: { id: rentalId }, include: { client: true, lines: { include: { model: true } } } });
  const ids: Record<string, string> = r ? (typeof r.googleEventIds === "object" && r.googleEventIds ? { ...(r.googleEventIds as Record<string, string>) } : {}) : { ...deletedIds };
  if (!r) {
    for (const id of Object.values(ids)) await google.delete(cfg.calendars.rentals, id);
    return "deleted";
  }
  const lines = r.lines.map((l) => `${l.quantity}× ${modelLabel(l.model)}`).join("\n");
  const event: GoogleEvent = {
    summary: `Rental – ${r.client.name}${r.status === "returned" ? " (returned)" : ""}`,
    description: `${lines}\n${appUrl(`/rentals/${r.id}`)}`,
    start: { date: dateToString(r.startDate) },
    end: { date: addDays(dateToString(r.endDate), 1) },
    source: { title: "Vertigo Gear", url: appUrl(`/rentals/${r.id}`) },
  };
  const id = await google.upsert(cfg.calendars.rentals, ids.rental ?? null, event);
  await prisma.rental.update({ where: { id: rentalId }, data: { googleEventIds: { rental: id } } });
  return "synced";
}

/** Where an entry's Google event lives (CalendarEntry.googleEvent). */
export type GoogleRef = { calendarId: string; subject: string | null; eventId: string };

export function googleRef(v: unknown): GoogleRef | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  return typeof r.calendarId === "string" && typeof r.eventId === "string" ? { calendarId: r.calendarId, subject: typeof r.subject === "string" ? r.subject : null, eventId: r.eventId } : null;
}

/**
 * Push one calendar entry (meeting, time off, assignment) to Google, see
 * entry-events.ts. When the target moves (invitations switched on or off,
 * another creator, another person off), the old event is removed first.
 * Someone Google will not let us act as (no delegation, not a Workspace
 * address) falls back to the shared calendar. `deletedRef`: the event of
 * an entry that no longer exists, handed over by its last job.
 */
export async function syncEntry(entryId: string, makeClient?: (subject?: string) => GoogleCalendar, deletedRef?: GoogleRef | null): Promise<"skipped" | "invited" | "shared" | "deleted"> {
  const cfg = googleConfig();
  if (!cfg) return "skipped";
  const client = makeClient ?? ((subject?: string) => new GoogleCalendar(cfg.account, fetch, subject));
  const e = await prisma.calendarEntry.findUnique({
    where: { id: entryId },
    include: { project: { select: { name: true } }, createdBy: { select: { name: true, email: true, googleEmail: true } }, people: { include: { user: { select: { name: true, email: true, googleEmail: true } } } } },
  });
  let old = e ? googleRef(e.googleEvent) : (deletedRef ?? null);
  const remove = async (ref: GoogleRef) => {
    try {
      await client(ref.subject ?? undefined).delete(ref.calendarId, ref.eventId, { sendUpdates: Boolean(ref.subject) });
    } catch (err) {
      // Delegation withdrawn since: the event stays in that calendar; nothing else to do.
      if (!(err instanceof GoogleDelegationError)) throw err;
    }
  };
  if (!e) {
    if (old) await remove(old);
    return "deleted";
  }
  const entry: GoogleEntry = {
    id: e.id,
    kind: e.kind,
    title: e.title,
    notes: e.notes,
    location: e.location,
    projectName: e.project?.name ?? null,
    allDay: e.allDay,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    guests: e.guests,
    creator: e.createdBy ? { name: e.createdBy.name, email: e.createdBy.googleEmail || e.createdBy.email } : null,
    people: e.people.map((p) => ({ name: p.user.name, email: p.user.googleEmail || p.user.email })),
  };
  const opts = { sharedCalendarId: cfg.calendars.projects, appUrl };
  const write = async (t: GoogleTarget) => {
    if (old && (old.calendarId !== t.calendarId || old.subject !== (t.subject ?? null))) {
      await remove(old);
      old = null;
    }
    return client(t.subject).upsert(t.calendarId, old?.eventId ?? null, t.event, { sendUpdates: t.sendUpdates });
  };
  let used = entryGoogle(entry, { ...opts, invites: await appSettings.calendarInvites() });
  let eventId: string;
  try {
    eventId = await write(used);
  } catch (err) {
    if (!(err instanceof GoogleDelegationError)) throw err;
    used = entryGoogle(entry, { ...opts, invites: false });
    eventId = await write(used);
  }
  await prisma.calendarEntry.update({ where: { id: entryId }, data: { googleEvent: { calendarId: used.calendarId, subject: used.subject ?? null, eventId } } });
  return used.subject ? "invited" : "shared";
}

/** Queue a sync for every entry that has not ended, e.g. after invitations were switched on or off. */
export async function queueAllEntrySyncs(): Promise<number> {
  const rows = await prisma.calendarEntry.findMany({ where: { endsAt: { gte: new Date(Date.now() - 86_400_000) } }, select: { id: true } });
  if (rows.length) await prisma.outbox.createMany({ data: rows.map((r) => ({ type: "calendar.sync_entry", payload: { id: r.id, event: "calendar.resync" } })) });
  return rows.length;
}
