import { randomBytes } from "node:crypto";
import ical, { ICalCalendarMethod } from "ical-generator";
import { prisma } from "@/lib/db";
import { addDays, dateToString } from "@/lib/dates";
import { appConfig, PHASE_DATES, PROJECT_PHASES } from "../../../config/app.config";

/**
 * Read-only iCal feeds with secret tokens. Users subscribe to the URL in
 * Google Calendar / Apple Calendar; no Google API needed.
 */
export type FeedScope = "projects" | "rentals" | "mine";

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

const phaseLabel = (key: string) => PROJECT_PHASES.find((p) => p.key === key)?.label.split(".")[1].replace("_", "-") ?? key;

export async function buildFeed(scope: FeedScope, userId: string | null): Promise<string> {
  const cal = ical({ name: `${appConfig.name} – ${scope === "mine" ? "My jobs" : scope === "projects" ? "Projects" : "Rentals"}`, timezone: appConfig.timezone, method: ICalCalendarMethod.PUBLISH });

  if (scope === "projects" || scope === "mine") {
    const projects = await prisma.project.findMany({
      where: { status: { not: "cancelled" }, ...(scope === "mine" && userId ? { crew: { some: { userId } } } : {}) },
      include: { client: true, crew: { include: { user: true } } },
    });
    for (const p of projects) {
      const url = appUrl(`/projects/${p.id}`);
      const where = [p.venueName, p.venueAddress].filter(Boolean).join(", ");
      const summaryBase = `${p.name}${p.client ? ` (${p.client.name})` : ""}`;
      for (const phase of PROJECT_PHASES.map((x) => x.key)) {
        const spec = PHASE_DATES[phase];
        const start = p[spec.start as keyof typeof p] as Date | null;
        if (!start) continue;
        const end = spec.end ? (p[spec.end as keyof typeof p] as Date | null) : null;
        const allDay = phase === "prep" || phase === "return";
        const ev = cal.createEvent({
          id: `${p.id}-${phase}@vertigo-gear`,
          start,
          end: allDay ? new Date(`${addDays(dateToString(end ?? start), 1)}T00:00:00Z`) : end && end > start ? end : new Date(start.getTime() + 2 * 3600_000),
          allDay,
          summary: `${summaryBase} – ${phaseLabel(phase)}`,
          description: `${phaseLabel(phase)} · ${p.status}\n${url}`,
          location: where || undefined,
          url,
        });
        if (scope === "mine") {
          const me = p.crew.find((c) => c.userId === userId);
          if (me?.callTime && phase === "load_in") ev.description(`${phaseLabel(phase)} · call ${me.callTime.toISOString()}\n${url}`);
        }
      }
    }
  }

  if (scope === "rentals") {
    const rentals = await prisma.rental.findMany({ where: { status: { not: "returned" } }, include: { client: true, lines: { include: { model: true } } } });
    for (const r of rentals) {
      const url = appUrl(`/rentals/${r.id}`);
      cal.createEvent({
        id: `${r.id}@vertigo-gear`,
        start: r.startDate,
        end: new Date(`${addDays(dateToString(r.endDate), 1)}T00:00:00Z`),
        allDay: true,
        summary: `Rental – ${r.client.name}`,
        description: `${r.lines.map((l) => `${l.quantity}× ${l.model.manufacturer} ${l.model.name}`).join("\n")}\n${url}`,
        url,
      });
    }
  }

  return cal.toString();
}
