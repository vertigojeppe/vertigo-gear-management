import { prisma } from "@/lib/db";
import { addDays, dayInZone, today, type DateString } from "@/lib/dates";
import { listsForProjects, type ListSummary } from "@/modules/packing";
import { timelineBars, type TimelineBar } from "@/modules/projects";
import { entriesBetween } from "@/modules/agenda";
import { phaseItems, phasesOf, sortAgenda, timeOf, type AgendaItem, type BoardPhase } from "./logic";

/** Jobs on the board: confirmed and running ones. Quotes are not certain yet; done and cancelled are over. */
const ON_BOARD = ["confirmed", "in_progress"];

export type BoardJob = {
  id: string;
  name: string;
  status: string;
  clientName: string | null;
  venueName: string | null;
  from: DateString;
  to: DateString;
  phases: BoardPhase[];
  crew: { name: string; role: string | null }[];
  lists: ListSummary[];
};

export type BoardData = {
  today: DateString;
  tomorrow: DateString;
  jobs: BoardJob[];
  agenda: { day: DateString; items: AgendaItem[] }[];
  timeline: { from: DateString; to: DateString; bars: TimelineBar[] };
};

/**
 * Everything the office screen shows, read once per refresh: the jobs of
 * the next `cardDays` days (running ones included) with crew and packing
 * lists, today's and tomorrow's agenda (phases, plan schedule, rentals
 * going out and coming back), and every job and rental of the next
 * `months` months for the long timeline.
 */
export async function boardData(opts: { cardDays?: number; months?: number } = {}): Promise<BoardData> {
  const cardDays = opts.cardDays ?? 14;
  const months = opts.months ?? 6;
  const t = today();
  const tomorrow = addDays(t, 1);
  const cardsTo = addDays(t, cardDays - 1);
  const timelineTo = addDays(t, Math.round(months * 30.44) - 1);
  const day = (s: DateString) => new Date(`${s}T00:00:00Z`);

  // Plan schedule entries on today and tomorrow (Copenhagen days; the UTC window is wide enough for any offset).
  const from = new Date(day(t).getTime() - 3 * 3600_000);
  const to = new Date(day(tomorrow).getTime() + 27 * 3600_000);
  const [{ projects, lists }, entries, rentals, bars, calendarEntries] = await Promise.all([
    prisma.project
      .findMany({
        where: { status: { in: ON_BOARD }, reserveFrom: { lte: day(cardsTo) }, reserveTo: { gte: day(t) } },
        include: { client: { select: { name: true } }, crew: { include: { user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } } },
        orderBy: { reserveFrom: "asc" },
      })
      .then(async (projects) => ({ projects, lists: await listsForProjects(projects.map((p) => p.id)) })),
    prisma.scheduleEntry.findMany({
      where: { startsAt: { gte: from, lte: to }, plan: { project: { status: { in: ON_BOARD } } } },
      include: { plan: { select: { project: { select: { name: true } } } } },
      orderBy: [{ startsAt: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.rental.findMany({
      where: { OR: [{ startDate: { gte: day(t), lte: day(tomorrow) } }, { endDate: { gte: day(t), lte: day(tomorrow) } }], status: { not: "returned" } },
      include: { client: { select: { name: true } } },
    }),
    timelineBars(t, timelineTo),
    entriesBetween(t, tomorrow),
  ]);

  const jobs: BoardJob[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    clientName: p.client?.name ?? null,
    venueName: p.venueName,
    from: p.reserveFrom!.toISOString().slice(0, 10),
    to: p.reserveTo!.toISOString().slice(0, 10),
    phases: phasesOf(p),
    crew: p.crew.map((c) => ({ name: c.user.name, role: c.role })),
    lists: lists.get(p.id) ?? [],
  }));

  const agenda = [t, tomorrow].map((d) => {
    const items: AgendaItem[] = [
      ...jobs.flatMap((j) => phaseItems(j, d)),
      ...entries
        .filter((e) => dayInZone(e.startsAt) === d)
        .map((e) => ({
          day: d,
          time: timeOf(e.startsAt),
          endTime: e.durationMin ? timeOf(new Date(e.startsAt.getTime() + e.durationMin * 60_000)) : null,
          kind: "schedule" as const,
          title: e.title,
          context: e.plan.project.name,
          where: e.location,
        })),
      ...rentals.flatMap((r) => {
        const out: AgendaItem[] = [];
        if (r.startDate.toISOString().slice(0, 10) === d) out.push({ day: d, time: null, endTime: null, kind: "rental_out", title: r.client.name, context: null, where: null });
        if (r.endDate.toISOString().slice(0, 10) === d) out.push({ day: d, time: null, endTime: null, kind: "rental_back", title: r.client.name, context: null, where: null });
        return out;
      }),
      // Meetings, time off and assignments: the time on the first day, the end on the last.
      ...calendarEntries
        .filter((e) => e.from <= d && e.to >= d)
        .map((e) => ({
          day: d,
          time: e.allDay || e.from !== d ? null : timeOf(e.startsAt),
          endTime: e.allDay || e.to !== d ? null : timeOf(e.endsAt),
          kind: "entry" as const,
          title: e.kind === "time_off" ? e.people.map((p) => p.name).join(", ") : e.title,
          off: e.kind === "time_off",
          context: [e.kind === "time_off" ? null : e.people.map((p) => p.name).join(", ") || null, e.projectName].filter(Boolean).join(" · ") || null,
          where: e.location,
        })),
    ];
    return { day: d, items: sortAgenda(items) };
  });

  // Quotes stay on the long timeline (greyed by their colour); they are part of planning ahead.
  return { today: t, tomorrow, jobs, agenda, timeline: { from: t, to: timelineTo, bars: bars.filter((b) => b.status !== "done") } };
}
