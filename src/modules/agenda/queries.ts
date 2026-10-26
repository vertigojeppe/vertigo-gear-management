import { prisma } from "@/lib/db";
import { addDays, dateFromString, dayInZone, type DateString } from "@/lib/dates";
import { entryDays, entryKind } from "./logic";
import type { EntryKind } from "../../../config/app.config";

export type EntryRow = {
  id: string;
  kind: EntryKind;
  title: string;
  notes: string | null;
  location: string | null;
  projectId: string | null;
  projectName: string | null;
  allDay: boolean;
  startsAt: Date;
  endsAt: Date;
  /** Inclusive Copenhagen days the entry covers. */
  from: DateString;
  to: DateString;
  guests: string[];
  createdById: string | null;
  createdByName: string | null;
  people: { id: string; name: string }[];
};

const include = { project: { select: { name: true } }, createdBy: { select: { name: true } }, people: { include: { user: { select: { id: true, name: true } } } } } as const;

type Row = Awaited<ReturnType<typeof prisma.calendarEntry.findFirstOrThrow<{ include: typeof include }>>>;

function toRow(e: Row): EntryRow {
  return {
    id: e.id,
    kind: entryKind(e.kind),
    title: e.title,
    notes: e.notes,
    location: e.location,
    projectId: e.projectId,
    projectName: e.project?.name ?? null,
    allDay: e.allDay,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    ...entryDays(e, dayInZone),
    guests: e.guests,
    createdById: e.createdById,
    createdByName: e.createdBy?.name ?? null,
    people: e.people.map((p) => p.user).sort((a, b) => a.name.localeCompare(b.name, "da")),
  };
}

/** Entries on any day from `from` to `to` (inclusive Copenhagen days), optionally only one person's or one project's. */
export async function entriesBetween(from: DateString, to: DateString, opts: { userId?: string; projectId?: string } = {}): Promise<EntryRow[]> {
  // A day of margin either side covers timed entries near midnight in any offset; the exact days are checked after.
  const rows = await prisma.calendarEntry.findMany({
    where: {
      startsAt: { lt: dateFromString(addDays(to, 2)) },
      endsAt: { gte: dateFromString(addDays(from, -1)) },
      ...(opts.userId ? { OR: [{ people: { some: { userId: opts.userId } } }, { createdById: opts.userId, people: { none: {} } }] } : {}),
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
    },
    include,
    orderBy: { startsAt: "asc" },
  });
  return rows.map(toRow).filter((e) => e.from <= to && e.to >= from);
}

/** A project's entries from a week ago onwards. */
export async function entriesForProject(projectId: string, today: DateString): Promise<EntryRow[]> {
  const rows = await prisma.calendarEntry.findMany({ where: { projectId, endsAt: { gte: dateFromString(addDays(today, -8)) } }, include, orderBy: { startsAt: "asc" } });
  return rows.map(toRow);
}

export async function entryDetail(id: string): Promise<EntryRow | null> {
  const e = await prisma.calendarEntry.findUnique({ where: { id }, include });
  return e ? toRow(e) : null;
}

/** People who can be on an entry: active users, not the office screen account. */
export async function entryPeopleOptions() {
  return prisma.user.findMany({ where: { active: true, role: { not: "display" } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** Running and coming projects to tie an entry to. */
export async function entryProjectOptions() {
  return prisma.project.findMany({ where: { status: { in: ["quote", "confirmed", "in_progress"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}
