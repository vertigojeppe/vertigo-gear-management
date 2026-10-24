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
  opts: { calendar?: { kind: "project" | "rental"; id: string; eventIds?: unknown } } = {},
): Promise<void> {
  const occurredAt = new Date().toISOString();
  const hooks = await prisma.webhook.findMany({ where: { active: true } });
  const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonObject;
  const rows: { type: string; payload: Prisma.InputJsonObject }[] = hooks
    .filter((h) => h.events.length === 0 || h.events.includes(type))
    .map((h) => ({ type: "webhook.deliver", payload: json({ webhookId: h.id, event: type, data, occurredAt }) }));

  if (opts.calendar) {
    const jobType = opts.calendar.kind === "project" ? "calendar.sync_project" : "calendar.sync_rental";
    const eventIds = opts.calendar.eventIds && typeof opts.calendar.eventIds === "object" ? opts.calendar.eventIds : undefined;
    // A pending sync of the same row will do, unless this one carries the ids of a deleted row.
    const pending = eventIds
      ? null
      : await prisma.outbox.findFirst({ where: { type: jobType, status: "pending", payload: { path: ["id"], equals: opts.calendar.id } } });
    if (!pending) rows.push({ type: jobType, payload: json({ id: opts.calendar.id, event: type, occurredAt, ...(eventIds ? { eventIds } : {}) }) });
  }
  if (rows.length) await prisma.outbox.createMany({ data: rows });
}
