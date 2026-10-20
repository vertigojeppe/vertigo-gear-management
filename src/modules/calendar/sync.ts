import { prisma } from "@/lib/db";
import { dateToString, addDays } from "@/lib/dates";
import { appConfig, PHASE_DATES, PROJECT_PHASES, type ProjectPhase } from "../../../config/app.config";
import { GoogleCalendar, googleConfig, type GoogleEvent } from "./google";
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

/** Build the per-phase events for a project. Exported for tests. */
export function projectPhaseEvents(p: {
  id: string;
  name: string;
  venueName: string | null;
  venueAddress: string | null;
  prepStart: Date | null;
  prepEnd: Date | null;
  buildStart: Date | null;
  buildEnd: Date | null;
  buildCall: string | null;
  showStart: Date | null;
  showEnd: Date | null;
  packStart: Date | null;
  packEnd: Date | null;
  packCall: string | null;
  returnDate: Date | null;
  client: { name: string } | null;
  crew: { user: { googleEmail: string | null } }[];
}): Partial<Record<ProjectPhase, GoogleEvent>> {
  const out: Partial<Record<ProjectPhase, GoogleEvent>> = {};
  const attendees = p.crew.map((c) => c.user.googleEmail).filter((e): e is string => Boolean(e)).map((email) => ({ email }));
  const base = {
    location: [p.venueName, p.venueAddress].filter(Boolean).join(", ") || undefined,
    source: { title: "Vertigo Gear", url: appUrl(`/projects/${p.id}`) },
    attendees: attendees.length ? attendees : undefined,
  };
  const description = (phase: string) => `${phase} · ${p.client?.name ?? "No client"}${p.venueName ? ` · ${p.venueName}` : ""}\n${appUrl(`/projects/${p.id}`)}`;
  const get = (k: string) => p[k as keyof typeof p] as Date | null;

  for (const phase of PROJECT_PHASES.map((x) => x.key)) {
    const spec = PHASE_DATES[phase];
    const start = get(spec.start);
    if (!start) continue;
    const end = spec.end ? get(spec.end) : null;
    const call = spec.call ? (p[spec.call as keyof typeof p] as string | null) : null;
    const summary = `${p.name} – ${spec.title}${call ? ` (call ${call})` : ""}`;
    if (spec.allDay) {
      // Day ranges become one all-day event over every day (end exclusive in Google).
      const startDay = dateToString(start);
      const endDay = end && end > start ? dateToString(end) : startDay;
      out[phase] = { ...base, summary, description: description(spec.title), start: { date: startDay }, end: { date: addDays(endDay, 1) } };
    } else {
      const endTime = end && end > start ? end : new Date(start.getTime() + 2 * 3600_000);
      out[phase] = {
        ...base,
        summary,
        description: description(spec.title),
        start: { dateTime: start.toISOString(), timeZone: TZ },
        end: { dateTime: endTime.toISOString(), timeZone: TZ },
      };
    }
  }
  return out;
}

export async function syncProject(projectId: string, client?: GoogleCalendar): Promise<"skipped" | "synced" | "deleted"> {
  const cfg = googleConfig();
  if (!cfg) return "skipped";
  const google = client ?? new GoogleCalendar(cfg.account);
  const p = await prisma.project.findUnique({ where: { id: projectId }, include: { client: true, crew: { include: { user: true } } } });
  const ids: Record<string, string> = p && typeof p.googleEventIds === "object" && p.googleEventIds ? { ...(p.googleEventIds as Record<string, string>) } : {};

  // Deleted or cancelled or back to quote: remove everything we created.
  if (!p || p.status === "cancelled" || p.status === "quote") {
    for (const id of Object.values(ids)) await google.delete(cfg.calendars.projects, id);
    if (p) await prisma.project.update({ where: { id: projectId }, data: { googleEventIds: {} } });
    return "deleted";
  }

  const events = projectPhaseEvents(p);
  const next: Record<string, string> = {};
  for (const phase of PROJECT_PHASES.map((x) => x.key)) {
    const ev = events[phase];
    if (ev) next[phase] = await google.upsert(cfg.calendars.projects, ids[phase] ?? null, ev);
    else if (ids[phase]) await google.delete(cfg.calendars.projects, ids[phase]);
  }
  await prisma.project.update({ where: { id: projectId }, data: { googleEventIds: next } });
  return "synced";
}

export async function syncRental(rentalId: string, client?: GoogleCalendar): Promise<"skipped" | "synced" | "deleted"> {
  const cfg = googleConfig();
  if (!cfg || !cfg.calendars.rentals) return "skipped";
  const google = client ?? new GoogleCalendar(cfg.account);
  const r = await prisma.rental.findUnique({ where: { id: rentalId }, include: { client: true, lines: { include: { model: true } } } });
  const ids: Record<string, string> = r && typeof r.googleEventIds === "object" && r.googleEventIds ? { ...(r.googleEventIds as Record<string, string>) } : {};
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
