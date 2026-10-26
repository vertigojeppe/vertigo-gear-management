import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { queueCalendarSync } from "@/lib/events";
import { formatDate, formatDateTime } from "@/lib/format";
import { AgendaError, entryTimes, entryTitle, parseGuests } from "./logic";
import type { EntryInput } from "./schema";

export { AgendaError };

/** "meeting Rig check (12.11.2026 10:00 – 11:00)" for activity rows. */
function describe(e: { kind: string; title: string; allDay: boolean; startsAt: Date; endsAt: Date }) {
  const when = e.allDay
    ? e.startsAt.getTime() === e.endsAt.getTime()
      ? formatDate(e.startsAt.toISOString().slice(0, 10))
      : `${formatDate(e.startsAt.toISOString().slice(0, 10))} – ${formatDate(e.endsAt.toISOString().slice(0, 10))}`
    : `${formatDateTime(e.startsAt)} – ${formatDateTime(e.endsAt)}`;
  return `${e.kind.replace("_", " ")} ${e.title} (${when})`;
}

/** Checks the form and the people; time off is one person (the actor unless someone else is picked). */
async function prepare(actor: Actor, input: EntryInput, peopleIds: string[]) {
  const kind = input.kind;
  const title = entryTitle(kind, input.title);
  const times = entryTimes({ kind, allDay: input.allDay, fromDate: input.fromDate, toDate: input.toDate, startTime: input.startTime, endTime: input.endTime });
  let guests = parseGuests(input.guestsText);
  let people = [...new Set(peopleIds.filter(Boolean))];
  if (kind === "time_off") {
    if (people.length === 0) people = [actor.id];
    if (people.length > 1) throw new AgendaError("Time off is for one person; make one entry each.", "people");
    guests = [];
  }
  if (people.length) {
    const found = await prisma.user.count({ where: { id: { in: people }, active: true, role: { not: "display" } } });
    if (found !== people.length) throw new AgendaError("Someone on the list is not an active user.", "people");
  }
  if (input.projectId && !(await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } }))) throw new AgendaError("That project no longer exists.", "projectId");
  return { kind, title, ...times, guests, people, projectId: input.projectId ?? null, location: input.location ?? null, notes: input.notes ?? null };
}

/**
 * Calendar entries: meetings, time off and small assignments. Every change
 * queues a Google sync (calendar/sync.ts `syncEntry`); a deleted entry hands
 * its Google event to that job, since the row that stored it is gone.
 */
export const entries = {
  async create(actor: Actor, input: EntryInput, peopleIds: string[]): Promise<string> {
    assertCan(actor, "agenda.write");
    const d = await prepare(actor, input, peopleIds);
    const id = await prisma.$transaction(async (tx) => {
      const e = await tx.calendarEntry.create({
        data: { kind: d.kind, title: d.title, notes: d.notes, location: d.location, projectId: d.projectId, allDay: d.allDay, startsAt: d.startsAt, endsAt: d.endsAt, guests: d.guests, createdById: actor.id, people: { create: d.people.map((userId) => ({ userId })) } },
      });
      await logActivity(actor, { entityType: "entry", entityId: e.id, action: "created", summary: `Added ${describe(e)}` }, tx);
      return e.id;
    });
    await queueCalendarSync({ kind: "entry", id }, "entry.created");
    return id;
  },

  async update(actor: Actor, id: string, input: EntryInput, peopleIds: string[]): Promise<void> {
    assertCan(actor, "agenda.write");
    await prisma.calendarEntry.findUniqueOrThrow({ where: { id }, select: { id: true } });
    const d = await prepare(actor, input, peopleIds);
    await prisma.$transaction(async (tx) => {
      await tx.calendarEntryPerson.deleteMany({ where: { entryId: id } });
      const e = await tx.calendarEntry.update({
        where: { id },
        data: { kind: d.kind, title: d.title, notes: d.notes, location: d.location, projectId: d.projectId, allDay: d.allDay, startsAt: d.startsAt, endsAt: d.endsAt, guests: d.guests, people: { create: d.people.map((userId) => ({ userId })) } },
      });
      await logActivity(actor, { entityType: "entry", entityId: id, action: "updated", summary: `Changed ${describe(e)}` }, tx);
    });
    await queueCalendarSync({ kind: "entry", id }, "entry.updated");
  },

  async remove(actor: Actor, id: string): Promise<void> {
    assertCan(actor, "agenda.write");
    const e = await prisma.calendarEntry.findUniqueOrThrow({ where: { id } });
    await prisma.$transaction(async (tx) => {
      await tx.calendarEntry.delete({ where: { id } });
      await logActivity(actor, { entityType: "entry", entityId: id, action: "deleted", summary: `Deleted ${describe(e)}` }, tx);
    });
    // The Google event goes with the job: the row that stored it is gone.
    await queueCalendarSync({ kind: "entry", id, eventIds: e.googleEvent ?? undefined }, "entry.deleted");
  },
};
