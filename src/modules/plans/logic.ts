import { addDays, dateFromString, dateToZonedInput, dayInZone, zonedInputToDate, type DateString } from "@/lib/dates";
import { PLAN_PHASES, fileConfig, type LogisticsKind, type PlanPhase } from "../../../config/app.config";
import { formatDateTime, formatDayRange } from "@/lib/format";

export type DocumentKind = "image" | "pdf" | "model3d" | "native" | "other";

/** A Word (or other office text) file that becomes a PDF when added to a plan. */
export function convertsToPdf(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return false;
  const ext = name.slice(dot).toLowerCase();
  return (fileConfig.convertToPdf as readonly string[]).includes(ext);
}

/** Which viewer a document gets, by MIME type first, then extension. */
export function documentKind(name: string, mimeType: string): DocumentKind {
  const ext = "." + (name.split(".").pop() ?? "").toLowerCase();
  if ((fileConfig.inlineViewers.image as readonly string[]).includes(mimeType)) return "image";
  if ((fileConfig.inlineViewers.pdf as readonly string[]).includes(mimeType) || ext === ".pdf") return "pdf";
  if ((fileConfig.inlineViewers.model3d as readonly string[]).includes(ext)) return "model3d";
  if ((fileConfig.nativeOnly as readonly string[]).includes(ext)) return "native";
  if (mimeType.startsWith("image/")) return "image";
  return "other";
}

/**
 * Pure helpers for production plans: grouping a schedule into days, task
 * progress, and turning a template (day offsets) into dated entries and
 * back. No database access, so everything here is unit-tested.
 */

export type ScheduleLike = { startsAt: Date; durationMin: number | null; sortOrder?: number };

/** "HH:MM" in Copenhagen for an instant. */
export function timeOfDay(d: Date): string {
  return dateToZonedInput(d).slice(11, 16);
}

/** End time "HH:MM" when a duration is known. */
export function endTime(startsAt: Date, durationMin: number | null | undefined): string | null {
  if (!durationMin) return null;
  return timeOfDay(new Date(startsAt.getTime() + durationMin * 60_000));
}

/** Schedule entries grouped by Copenhagen day, days and entries sorted. */
export function groupByDay<T extends ScheduleLike>(entries: T[]): { day: DateString; entries: T[] }[] {
  const byDay = new Map<DateString, T[]>();
  for (const e of entries) {
    const day = dayInZone(e.startsAt);
    const list = byDay.get(day) ?? [];
    list.push(e);
    byDay.set(day, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, list]) => ({ day, entries: list.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) }));
}

export type TaskLike = { phase: string; done: boolean };

export function taskProgress(tasks: TaskLike[]) {
  const byPhase = PLAN_PHASES.map((phase) => {
    const list = tasks.filter((t) => t.phase === phase);
    return { phase, total: list.length, done: list.filter((t) => t.done).length };
  });
  return { total: tasks.length, done: tasks.filter((t) => t.done).length, byPhase };
}

/** Tasks in phase order, open ones first within a phase, then by due date. */
export function sortTasks<T extends { phase: string; done: boolean; dueDate: string | null; sortOrder: number }>(tasks: T[]): T[] {
  const order = new Map<string, number>(PLAN_PHASES.map((p, i) => [p, i]));
  return [...tasks].sort((a, b) => {
    const pa = order.get(a.phase) ?? 99;
    const pb = order.get(b.phase) ?? 99;
    if (pa !== pb) return pa - pb;
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.dueDate !== b.dueDate) return (a.dueDate ?? "9999") < (b.dueDate ?? "9999") ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
}

/* Templates ---------------------------------------------------------------- */

export type TemplateEntryLike = {
  kind: string;
  dayOffset: number;
  time: string | null;
  durationMin: number | null;
  title: string;
  location: string | null;
  phase: string | null;
  logisticsKind: string | null;
  notes: string | null;
  sortOrder: number;
};

export type Materialised = {
  schedule: { startsAt: Date; durationMin: number | null; title: string; location: string | null; notes: string | null; sortOrder: number }[];
  tasks: { phase: PlanPhase; title: string; dueDate: DateString | null; notes: string | null; sortOrder: number }[];
  logistics: { kind: LogisticsKind; title: string; details: string | null; at: Date | null; sortOrder: number }[];
};

/** Turn template entries into dated plan entries around an anchor day (first build-up day = day 0). */
export function materialiseTemplate(entries: TemplateEntryLike[], anchor: DateString): Materialised {
  const out: Materialised = { schedule: [], tasks: [], logistics: [] };
  for (const e of [...entries].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const day = addDays(anchor, e.dayOffset);
    if (e.kind === "schedule") {
      out.schedule.push({ startsAt: zonedInputToDate(`${day}T${e.time ?? "09:00"}`), durationMin: e.durationMin, title: e.title, location: e.location, notes: e.notes, sortOrder: e.sortOrder });
    } else if (e.kind === "task") {
      out.tasks.push({ phase: (PLAN_PHASES as readonly string[]).includes(e.phase ?? "") ? (e.phase as PlanPhase) : "pre_production", title: e.title, dueDate: day, notes: e.notes, sortOrder: e.sortOrder });
    } else {
      out.logistics.push({ kind: (e.logisticsKind ?? "other") as LogisticsKind, title: e.title, details: e.notes, at: e.time ? zonedInputToDate(`${day}T${e.time}`) : null, sortOrder: e.sortOrder });
    }
  }
  return out;
}

/** Whole days from the anchor to a day (negative before). */
export function dayOffset(anchor: DateString, day: DateString): number {
  return Math.round((dateFromString(day).getTime() - dateFromString(anchor).getTime()) / 86_400_000);
}

/** Inverse of materialiseTemplate: plan rows → template entries relative to the anchor. */
export function templateFromPlan(
  plan: {
    schedule: { startsAt: Date; durationMin: number | null; title: string; location: string | null; notes: string | null; sortOrder: number }[];
    tasks: { phase: string; title: string; dueDate: DateString | null; notes: string | null; sortOrder: number }[];
    logistics: { kind: string; title: string; details: string | null; at: Date | null; sortOrder: number }[];
  },
  anchor: DateString,
): Omit<TemplateEntryLike, "sortOrder">[] & { sortOrder?: number }[] {
  const out: TemplateEntryLike[] = [];
  let i = 0;
  for (const s of plan.schedule) {
    out.push({ kind: "schedule", dayOffset: dayOffset(anchor, dayInZone(s.startsAt)), time: timeOfDay(s.startsAt), durationMin: s.durationMin, title: s.title, location: s.location, phase: null, logisticsKind: null, notes: s.notes, sortOrder: i++ });
  }
  for (const t of plan.tasks) {
    out.push({ kind: "task", dayOffset: t.dueDate ? dayOffset(anchor, t.dueDate) : 0, time: null, durationMin: null, title: t.title, location: null, phase: t.phase, logisticsKind: null, notes: t.notes, sortOrder: i++ });
  }
  for (const l of plan.logistics) {
    out.push({ kind: "logistics", dayOffset: l.at ? dayOffset(anchor, dayInZone(l.at)) : 0, time: l.at ? timeOfDay(l.at) : null, durationMin: null, title: l.title, location: null, phase: null, logisticsKind: l.kind, notes: l.details, sortOrder: i++ });
  }
  return out;
}

/** The day a project's plan hangs on: the first build-up day, else show start, else prep start. */
export function defaultAnchor(project: { buildStart: Date | string | null; showStart: Date | string | null; prepStart: Date | string | null }, fallback: DateString): DateString {
  const d = project.buildStart ?? project.showStart ?? project.prepStart;
  if (!d) return fallback;
  if (typeof d === "string") return d.length === 10 ? d : dayInZone(new Date(d));
  return dayInZone(d);
}

/* 3D measure ------------------------------------------------------------- */

export const MODEL_UNITS = ["mm", "cm", "m"] as const;
export type ModelUnit = (typeof MODEL_UNITS)[number];

/** glTF is metres by definition; STL and OBJ carry no unit and are usually exported in millimetres. */
export function defaultModelUnit(ext: string): ModelUnit {
  return ext === "glb" || ext === "gltf" ? "m" : "mm";
}

/** A raw file-unit distance as a readable metric length: "1.25 m" or "45.3 cm". */
export function formatDistance(raw: number, unit: ModelUnit): string {
  const metres = unit === "m" ? raw : unit === "cm" ? raw / 100 : raw / 1000;
  if (metres >= 1) return `${(Math.round(metres * 100) / 100).toFixed(2)} m`;
  return `${(Math.round(metres * 1000) / 10).toFixed(1)} cm`;
}

type DatesLineProject = {
  buildStart: Date | string | null;
  buildEnd: Date | string | null;
  buildCall: string | null;
  showStart: Date | string | null;
  packStart: Date | string | null;
  packEnd: Date | string | null;
  packCall: string | null;
};

/** The plan header: "Build-up 12.09.2026 – 13.09.2026, call 08:00 · Show 13.09.2026 20:00 · Pack-down 14.09.2026, call 08:00". */
export function datesLine(
  p: DatesLineProject,
  words: { build: string; show: string; pack: string; call: (time: string) => string } = { build: "Build-up", show: "Show", pack: "Pack-down", call: (time) => `call ${time}` },
): string {
  const range = (label: string, from: Date | string | null, to: Date | string | null, call: string | null) =>
    from ? `${label} ${formatDayRange(from, to)}${call ? `, ${words.call(call)}` : ""}` : null;
  return [
    range(words.build, p.buildStart, p.buildEnd, p.buildCall),
    p.showStart ? `${words.show} ${formatDateTime(p.showStart)}` : null,
    range(words.pack, p.packStart, p.packEnd, p.packCall),
  ]
    .filter(Boolean)
    .join(" · ");
}
