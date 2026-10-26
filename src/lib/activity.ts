import { prisma, type Db } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";

export type ActivityEntity = "item" | "model" | "category" | "location" | "user" | "project" | "rental" | "settings" | "contact" | "wish" | "purchase" | "subhire" | "app" | "entry";

export type ActivityInput = {
  entityType: ActivityEntity;
  entityId: string;
  action: string;
  summary: string;
  details?: Record<string, unknown>;
};

/**
 * Append a row to the activity log. Pass the transaction client when
 * writing inside a transaction so the log entry rolls back with the change.
 */
export async function logActivity(actor: Actor | null, input: ActivityInput, db: Db | Parameters<Parameters<Db["$transaction"]>[0]>[0] = prisma) {
  await db.activityLog.create({
    data: {
      userId: actor?.id ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary,
      details: input.details === undefined ? undefined : JSON.parse(JSON.stringify(input.details)),
    },
  });
}

export async function activityFor(entityType: ActivityEntity, entityId: string, limit = 50) {
  return prisma.activityLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { id: true, name: true } } },
  });
}

export async function recentActivity(limit = 20) {
  return prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { id: true, name: true } } },
  });
}

/** Shallow diff of two plain objects for the `details` column. */
export function diffFields<T extends Record<string, unknown>>(before: T, after: Partial<T>): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) out[key] = { from: a ?? null, to: b ?? null };
  }
  return out;
}
