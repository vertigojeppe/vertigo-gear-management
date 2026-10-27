import { randomBytes } from "node:crypto";
import ical, { ICalCalendarMethod } from "ical-generator";
import { prisma } from "@/lib/db";
import { addDays, dateToString } from "@/lib/dates";
import { appConfig } from "../../../config/app.config";
import { formatDateTime, modelLabel } from "@/lib/format";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { appSettings } from "@/modules/settings/app-settings";
import { jobEvents } from "./job-events";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { entriesBetween } from "@/modules/agenda/queries";
import { today } from "@/lib/dates";

/**
 * Read-only iCal feeds with secret tokens. Users subscribe to the URL in
 * Google Calendar / Apple Calendar; no Google API needed.
 */
export type FeedScope = "projects" | "rentals" | "mine";

/** How far back the project feeds go; older jobs drop out of subscribed calendars. */
export const FEED_HISTORY_DAYS = 365;

function appUrl(path: string) {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

export const feedTokens = {
  /** Get or create the token for a scope (team-wide, or per user for "mine"). */
  async ensure(scope: FeedScope, userId: string | null) {
    const existing = await prisma.calendarFeedToken.findFirst({ where: { scope, userId: scope === "mine" ? userId : null } });
    if (existing) return existing;
    return prisma.calendarFeedToken.create({ data: { scope, userId: scope === "mine" ? userId : null, token: randomBytes(24).toString("base64url") } });
  },

  async rotate(scope: FeedScope, userId: string | null) {
    await prisma.calendarFeedToken.deleteMany({ where: { scope, userId: scope === "mine" ? userId : null } });
    return feedTokens.ensure(scope, userId);
  },

  async resolve(token: string) {
    return prisma.calendarFeedToken.findUnique({ where: { token } });
  },

  url(token: string, origin?: string) {
    return `${origin ?? appUrl("")}/api/calendar/${token}.ics`;
  },
};

export async function buildFeed(scope: FeedScope, userId: string | null): Promise<string> {
  const cal = ical({ name: `${appConfig.name} – ${scope === "mine" ? "My jobs" : scope === "projects" ? "Projects" : "Rentals"}`, timezone: appConfig.timezone, method: ICalCalendarMethod.PUBLISH });

  if (scope === "projects" || scope === "mine") {
    // Jobs that ended within the last year or are still to come (or have no dates yet); calendar apps poll this often.
    const since = new Date(`${addDays(today(), -FEED_HISTORY_DAYS)}T00:00:00Z`);
    const projects = await prisma.project.findMany({
      where: { status: { not: "cancelled" }, OR: [{ reserveTo: { gte: since } }, { reserveTo: null }], ...(scope === "mine" && userId ? { crew: { some: { userId } } } : {}) },
      include: { client: { select: { name: true } }, crew: { where: { userId: userId ?? "" }, select: { userId: true, callTime: true } } },
    });
    const callHours = await appSettings.callHours();
    for (const p of projects) {
      const url = appUrl(`/projects/${p.id}`);
      const where = [p.venueName, p.venueAddress].filter(Boolean).join(", ");
      const summaryBase = `${p.name}${p.client ? ` (${p.client.name})` : ""}`;
      const me = scope === "mine" ? p.crew.find((c) => c.userId === userId) : undefined;
      // One banner per job plus timed build-up / pack-down days and the show (job-events.ts).
      for (const ev of jobEvents(p, { callHours })) {
        const yourCall = me?.callTime ? `\nYour call: ${formatDateTime(me.callTime)}` : "";
        cal.createEvent({
          id: `${p.id}-${ev.key}@vertigo-gear`,
          ...(ev.allDay
            ? { start: new Date(`${ev.firstDay}T00:00:00Z`), end: new Date(`${addDays(ev.lastDay, 1)}T00:00:00Z`), allDay: true, summary: summaryBase, description: `${p.status}\n${ev.lines.join("\n")}${yourCall}\n${url}` }
            : { start: ev.start, end: ev.end, summary: `${summaryBase} – ${ev.title}`, description: `${ev.title} · ${p.status}${ev.phase === "load_in" ? yourCall : ""}\n${url}` }),
          location: where || undefined,
          url,
        });
      }
    }
  }

  // My meetings, time off and assignments, from two months back to a year ahead.
  if (scope === "mine" && userId) {
    for (const e of await entriesBetween(addDays(today(), -60), addDays(today(), 400), { userId })) {
      const url = appUrl(`/calendar/entries/${e.id}`);
      cal.createEvent({
        id: `${e.id}-entry@vertigo-gear`,
        start: e.allDay ? new Date(`${e.from}T00:00:00Z`) : e.startsAt,
        end: e.allDay ? new Date(`${addDays(e.to, 1)}T00:00:00Z`) : e.endsAt,
        allDay: e.allDay,
        summary: e.kind === "time_off" ? `Off${e.title !== "Off" ? ` (${e.title})` : ""}` : e.title,
        description: [e.notes, e.projectName ? `Job: ${e.projectName}` : null, e.people.map((p) => p.name).join(", ") || null, url].filter(Boolean).join("\n"),
        location: e.location ?? undefined,
        url,
      });
    }
  }

  if (scope === "rentals") {
    const rentals = await prisma.rental.findMany({ where: { status: { not: "returned" } }, include: { client: { select: { name: true } }, lines: { include: { model: { select: { name: true, variant: true } } } } } });
    for (const r of rentals) {
      const url = appUrl(`/rentals/${r.id}`);
      cal.createEvent({
        id: `${r.id}@vertigo-gear`,
        start: r.startDate,
        end: new Date(`${addDays(dateToString(r.endDate), 1)}T00:00:00Z`),
        allDay: true,
        summary: `Rental – ${r.client.name}`,
        description: `${r.lines.map((l) => `${l.quantity}× ${modelLabel(l.model)}`).join("\n")}\n${url}`,
        url,
      });
    }
  }

  return cal.toString();
}
