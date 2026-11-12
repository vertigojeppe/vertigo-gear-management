import { prisma } from "@/lib/db";
import { addDays, dateFromString, dayInZone, type DateString } from "@/lib/dates";
// eslint-disable-next-line no-restricted-imports -- the calendar barrel pulls server actions (next-auth) in; only the Google client is needed
import { googleConfig, searchGooglePeople } from "@/modules/calendar/google";
import { entryDays, entryKind, type GuestChoice } from "./logic";
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
  return prisma.user.findMany({ where: { active: true, hidden: false, role: { not: "display" } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** Running and coming projects to tie an entry to. */
export async function entryProjectOptions() {
  return prisma.project.findMany({ where: { status: { in: ["tba", "confirmed"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** What the Guests field suggests: contacts with an email address, then every guest address used before. */
export async function guestDirectory(): Promise<GuestChoice[]> {
  const [contacts, used] = await Promise.all([
    prisma.contact.findMany({ where: { email: { not: null } }, select: { name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.calendarEntry.findMany({ where: { guests: { isEmpty: false } }, select: { guests: true } }),
  ]);
  const byEmail = new Map<string, string | null>();
  for (const c of contacts) {
    const email = c.email!.trim().toLowerCase();
    if (email.includes("@") && !byEmail.has(email)) byEmail.set(email, c.name);
  }
  for (const e of used) for (const g of e.guests) if (!byEmail.has(g)) byEmail.set(g, null);
  return [...byEmail].map(([email, name]) => ({ email, name }));
}

/** People Google will not let us act as (no delegation for them, not a Workspace address), until when. */
const googleRefused = new Map<string, number>();

/**
 * Guest suggestions from Google, searched as the signed-in person: their
 * contacts, the people they have emailed and the Workspace directory, less
 * the app's own users (they are ticked as people). Empty when Google is not
 * set up, the query is under three letters, or Google refuses.
 */
export async function googleGuests(userId: string, query: string): Promise<GuestChoice[]> {
  const cfg = googleConfig();
  const q = query.trim();
  if (!cfg || q.length < 3) return [];
  const [me, users] = await Promise.all([prisma.user.findUnique({ where: { id: userId }, select: { email: true, googleEmail: true } }), prisma.user.findMany({ select: { email: true, googleEmail: true } })]);
  if (!me) return [];
  const subject = me.googleEmail || me.email;
  if ((googleRefused.get(subject) ?? 0) > Date.now()) return [];
  const colleagues = new Set(users.flatMap((u) => [u.email, u.googleEmail ?? ""]).map((e) => e.toLowerCase()));
  try {
    return (await searchGooglePeople(cfg.account, subject, q)).filter((p) => !colleagues.has(p.email));
  } catch {
    // shortcut: any refusal (or Google being down) pauses this person's lookups for ten minutes; the local suggestions still work.
    googleRefused.set(subject, Date.now() + 10 * 60_000);
    return [];
  }
}
