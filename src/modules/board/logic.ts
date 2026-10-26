import { daysBetween, dateToString, dayInZone, type DateString } from "@/lib/dates";
import { appConfig, PHASE_DATES, PROJECT_PHASES, type ProjectPhase } from "../../../config/app.config";

/**
 * The office screen (/board), pure parts: a job's phases as day ranges with
 * call times, the today / tomorrow agenda, and packing timeline bars into
 * as few rows as possible.
 */

export type JobDates = {
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
};

/** One phase: inclusive days, plus the call time (build-up, pack-down) or the show's start and end time. */
export type BoardPhase = { phase: ProjectPhase; from: DateString; to: DateString; time: string | null; endTime: string | null };

/** "08:00" in Copenhagen time. */
export function timeOf(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: appConfig.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function phasesOf(p: JobDates): BoardPhase[] {
  const out: BoardPhase[] = [];
  for (const phase of PROJECT_PHASES.map((x) => x.key)) {
    const spec = PHASE_DATES[phase];
    const start = p[spec.start as keyof JobDates] as Date | null;
    if (!start) continue;
    const endRaw = spec.end ? (p[spec.end as keyof JobDates] as Date | null) : null;
    const end = endRaw && endRaw > start ? endRaw : null;
    if (!spec.allDay) {
      out.push({ phase, from: dayInZone(start), to: end ? dayInZone(end) : dayInZone(start), time: timeOf(start), endTime: end ? timeOf(end) : null });
    } else {
      const call = spec.call ? (p[spec.call as keyof JobDates] as string | null) : null;
      out.push({ phase, from: dateToString(start), to: end ? dateToString(end) : dateToString(start), time: call || null, endTime: null });
    }
  }
  return out;
}

export type AgendaItem = {
  day: DateString;
  /** null = all day (shown first). */
  time: string | null;
  endTime: string | null;
  kind: "phase" | "schedule" | "rental_out" | "rental_back" | "entry";
  phase?: ProjectPhase;
  title: string;
  /** The job or client it belongs to. */
  context: string | null;
  where: string | null;
  /** Time off: the title is the person, shown after the (translated) word for off. */
  off?: boolean;
};

/** The phases of a job that fall on `day` as agenda items. */
export function phaseItems(job: { name: string; venueName: string | null; phases: BoardPhase[] }, day: DateString): AgendaItem[] {
  return job.phases
    .filter((ph) => ph.from <= day && ph.to >= day)
    .map((ph) => ({
      day,
      // A show over midnight starts on its first day only; a call time applies on every build-up / pack-down day.
      time: ph.phase === "show" ? (ph.from === day ? ph.time : null) : ph.time,
      endTime: ph.phase === "show" && ph.to === day ? ph.endTime : null,
      kind: "phase" as const,
      phase: ph.phase,
      title: job.name,
      context: null,
      where: job.venueName,
    }));
}

/** All-day items first, then by time; ties keep their order. */
export function sortAgenda(items: AgendaItem[]): AgendaItem[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => (a.item.time ?? "").localeCompare(b.item.time ?? "") || a.i - b.i)
    .map((x) => x.item);
}

/**
 * Bars in rows (lanes) so that bars which do not overlap share a row:
 * sorted by start, each bar goes into the first row whose last bar ended
 * before it starts. Keeps a year of jobs to a handful of rows.
 */
export function packLanes<T extends { from: DateString; to: DateString }>(bars: T[]): T[][] {
  const lanes: T[][] = [];
  for (const bar of [...bars].sort((a, b) => a.from.localeCompare(b.from) || b.to.localeCompare(a.to))) {
    const lane = lanes.find((l) => l[l.length - 1].to < bar.from);
    if (lane) lane.push(bar);
    else lanes.push([bar]);
  }
  return lanes;
}

/** Where a bar sits on a timeline from `start` over `days` days, in percent (clipped to the window). */
export function barSpan(bar: { from: DateString; to: DateString }, start: DateString, days: number): { left: number; width: number } {
  const first = Math.max(0, daysBetween(start, bar.from) - 1);
  const last = Math.min(days - 1, daysBetween(start, bar.to) - 1);
  return { left: (first / days) * 100, width: (Math.max(1, last - first + 1) / days) * 100 };
}
