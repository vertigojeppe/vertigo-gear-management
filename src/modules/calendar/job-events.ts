import { addDays, dateToString, dayInZone, daysBetween, zonedInputToDate, type DateString } from "@/lib/dates";
import { formatDate, formatDayRange } from "@/lib/format";
import { appConfig, CALL_HOURS, PHASE_DATES, PROJECT_PHASES, type ProjectPhase } from "../../../config/app.config";

/**
 * How a job appears in a calendar (pure; the Google push and the iCal feeds
 * both use it). Instead of an all-day event per phase, which flooded a day
 * with several jobs:
 * - one all-day banner over the whole job (first to last date), with every
 *   phase listed in its description;
 * - build-up and pack-down as timed events from their call time, one per
 *   day, `callHours` long (Settings › Calendar); without a call time they
 *   only show in the banner;
 * - the show as before (its own start and end, or two hours).
 * Prep and return have no events of their own.
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

export type JobEvent =
  /** The banner: inclusive first and last day. */
  | { key: "job"; allDay: true; title: null; firstDay: DateString; lastDay: DateString; lines: string[] }
  /** Build-up / pack-down days (key `load_in:<day>`) and the show (key `show`). */
  | { key: string; allDay: false; phase: ProjectPhase; title: string; start: Date; end: Date };

const DAY_PHASES: ProjectPhase[] = ["load_in", "load_out"];
const LABEL: Record<ProjectPhase, string> = { prep: "Prep", load_in: "Build-up", show: "Show", load_out: "Pack-down", return: "Return" };

/** "21.10.2026 20:00" in Copenhagen time. */
function dayAndTime(d: Date): string {
  const time = new Intl.DateTimeFormat("da-DK", { timeZone: appConfig.timezone, hour: "2-digit", minute: "2-digit" }).format(d).replace(".", ":");
  return `${formatDate(d)} ${time}`;
}

export function jobEvents(p: JobDates, opts: { callHours?: number } = {}): JobEvent[] {
  const hours = opts.callHours && opts.callHours > 0 ? opts.callHours : CALL_HOURS.default;
  const get = (k: string) => p[k as keyof JobDates] as Date | null;
  const events: JobEvent[] = [];
  const days: DateString[] = [];
  const lines: string[] = [];

  for (const phase of PROJECT_PHASES.map((x) => x.key)) {
    const spec = PHASE_DATES[phase];
    const start = get(spec.start);
    if (!start) continue;
    const endRaw = spec.end ? get(spec.end) : null;
    const end = endRaw && endRaw > start ? endRaw : null;
    const call = spec.call ? (p[spec.call as keyof JobDates] as string | null) : null;

    if (!spec.allDay) {
      // The show: two instants.
      const until = end ?? new Date(start.getTime() + 2 * 3600_000);
      events.push({ key: phase, allDay: false, phase, title: spec.title, start, end: until });
      days.push(dayInZone(start), dayInZone(until));
      lines.push(`${LABEL[phase]}: ${dayAndTime(start)}${end ? ` – ${dayAndTime(end)}` : ""}`);
      continue;
    }

    const firstDay = dateToString(start);
    const lastDay = end ? dateToString(end) : firstDay;
    days.push(firstDay, lastDay);
    lines.push(`${LABEL[phase]}: ${formatDayRange(firstDay, lastDay)}${call ? `, call ${call}` : ""}`);
    if (call && DAY_PHASES.includes(phase)) {
      for (let i = 0; i < daysBetween(firstDay, lastDay); i++) {
        const day = addDays(firstDay, i);
        const from = zonedInputToDate(`${day}T${call}`);
        events.push({ key: `${phase}:${day}`, allDay: false, phase, title: `${spec.title} (call ${call})`, start: from, end: new Date(from.getTime() + hours * 3600_000) });
      }
    }
  }

  if (days.length) {
    const sorted = [...days].sort();
    events.unshift({ key: "job", allDay: true, title: null, firstDay: sorted[0], lastDay: sorted[sorted.length - 1], lines });
  }
  return events;
}
