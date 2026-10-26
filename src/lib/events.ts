import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { WebhookEvent } from "../../config/app.config";

/**
 * Domain events. Services call emitEvent after a successful change; this
 * queues outbox rows for every active webhook subscribed to the event and,
 * for project/rental changes, a calendar sync job. The outbox worker
 * (src/lib/outbox.ts) delivers them. Nothing here talks to the network.
 *
 * A deleted project or rental passes its Google event ids along
 * (`calendar.eventIds`): the row that stored them is gone by the time the
 * job runs, and the job still has to remove the events.
 */
export async function emitEvent(
  type: WebhookEvent,
  data: Record<string, unknown>,
  opts: { calendar?: { kind: CalendarKind; id: string; eventIds?: unknown } } = {},
): Promise<void> {
  const occurredAt = new Date().toISOString();
  const hooks = await prisma.webhook.findMany({ where: { active: true } });
  const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonObject;
  const rows: { type: string; payload: Prisma.InputJsonObject }[] = hooks
    .filter((h) => h.events.length === 0 || h.events.includes(type))
    .map((h) => ({ type: "webhook.deliver", payload: json({ webhookId: h.id, event: type, data, occurredAt }) }));

  if (opts.calendar) {
    const row = await calendarSyncRow(opts.calendar, type, occurredAt);
    if (row) rows.push(row);
  }
  if (rows.length) await prisma.outbox.createMany({ data: rows });
}

export type CalendarKind = "project" | "rental" | "entry";
const SYNC_JOB: Record<CalendarKind, string> = { project: "calendar.sync_project", rental: "calendar.sync_rental", entry: "calendar.sync_entry" };

/** The outbox row for a calendar sync, or null when one for the same row is already pending. */
async function calendarSyncRow(cal: { kind: CalendarKind; id: string; eventIds?: unknown }, event: string, occurredAt: string) {
  const jobType = SYNC_JOB[cal.kind];
  const eventIds = cal.eventIds && typeof cal.eventIds === "object" ? cal.eventIds : undefined;
  // A pending sync of the same row will do, unless this one carries the ids of a deleted row.
  const pending = eventIds ? null : await prisma.outbox.findFirst({ where: { type: jobType, status: "pending", payload: { path: ["id"], equals: cal.id } } });
  if (pending) return null;
  return { type: jobType, payload: JSON.parse(JSON.stringify({ id: cal.id, event, occurredAt, ...(eventIds ? { eventIds } : {}) })) as Prisma.InputJsonObject };
}

/** A calendar sync without a webhook event (calendar entries: meetings, time off, assignments). */
export async function queueCalendarSync(cal: { kind: CalendarKind; id: string; eventIds?: unknown }, event: string): Promise<void> {
  const row = await calendarSyncRow(cal, event, new Date().toISOString());
  if (row) await prisma.outbox.create({ data: row });
}
