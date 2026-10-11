import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db";
import { outboxConfig } from "../../config/app.config";

/**
 * Minimal background worker. Outbox rows are claimed in small batches and
 * handed to a handler by `type`. Failures retry with exponential backoff
 * until maxAttempts, then the row is marked failed (visible in Settings).
 *
 * Runs in-process (started from instrumentation.ts) and can also be
 * triggered by POST /api/cron/outbox for hosts without long-lived processes.
 */
export type OutboxHandler = (payload: Record<string, unknown>) => Promise<void>;

const handlers = new Map<string, OutboxHandler>();

export function registerOutboxHandler(type: string, handler: OutboxHandler) {
  handlers.set(type, handler);
}

export async function processOutbox(limit = 20): Promise<{ processed: number; failed: number }> {
  const now = new Date();
  const due = await prisma.outbox.findMany({
    where: { status: "pending", nextRunAt: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let processed = 0;
  let failed = 0;
  for (const row of due) {
    // Claim: only proceed if nobody else took it.
    const claimed = await prisma.outbox.updateMany({ where: { id: row.id, status: "pending" }, data: { status: "processing" } });
    if (claimed.count === 0) continue;
    const handler = handlers.get(row.type);
    try {
      if (!handler) throw new Error(`No handler for ${row.type}`);
      await handler(row.payload as Record<string, unknown>);
      await prisma.outbox.update({ where: { id: row.id }, data: { status: "done", attempts: row.attempts + 1, lastError: null } });
      processed++;
    } catch (err) {
      const attempts = row.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      const giveUp = attempts >= outboxConfig.maxAttempts || !handler;
      await prisma.outbox.update({
        where: { id: row.id },
        data: {
          status: giveUp ? "failed" : "pending",
          attempts,
          lastError: message.slice(0, 1000),
          nextRunAt: new Date(Date.now() + outboxConfig.backoffBaseSeconds * 2 ** attempts * 1000),
        },
      });
      failed++;
    }
  }
  return { processed, failed };
}

let timer: NodeJS.Timeout | null = null;

/** Start the poller once per process. Safe to call repeatedly. */
export function startOutboxWorker() {
  if (timer || process.env.OUTBOX_DISABLED === "1") return;
  const tick = async () => {
    try {
      await processOutbox();
    } catch (err) {
      console.error("[outbox] tick failed", err);
    }
  };
  timer = setInterval(tick, outboxConfig.pollMs);
  timer.unref?.();
  void tick();
}

/* ---- webhook delivery handler ------------------------------------------ */

export function signBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

registerOutboxHandler("webhook.deliver", async (payload) => {
  const webhookId = String(payload.webhookId);
  const hook = await prisma.webhook.findUnique({ where: { id: webhookId } });
  if (!hook || !hook.active) return; // deleted or disabled: drop silently
  const body = JSON.stringify({ event: payload.event, occurredAt: payload.occurredAt, data: payload.data });
  const res = await fetch(hook.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "VertigoGear-Webhook/1",
      "X-Vertigo-Event": String(payload.event),
      "X-Vertigo-Signature": `sha256=${signBody(hook.secret, body)}`,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Webhook ${hook.name} answered ${res.status}`);
});
