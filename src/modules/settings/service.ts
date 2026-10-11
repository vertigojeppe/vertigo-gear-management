import { cache } from "react";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import type { CustomFieldDef, CustomFieldEntity } from "@/lib/custom-fields";
import { WEBHOOK_EVENTS } from "../../../config/app.config";
import type { CustomFieldDefinitionInput, WebhookInput } from "./schema";

export class SettingsError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "SettingsError";
  }
}

function toDef(row: { key: string; label: string; type: string; options: unknown; required: boolean }): CustomFieldDef {
  return {
    key: row.key,
    label: row.label,
    type: row.type as CustomFieldDef["type"],
    options: Array.isArray(row.options) ? (row.options as string[]) : [],
    required: row.required,
  };
}

export const customFieldDefinitions = {
  /** Definitions for one entity, in display order. Cached per request. */
  forEntity: cache(async (entity: CustomFieldEntity): Promise<CustomFieldDef[]> => {
    const rows = await prisma.customFieldDefinition.findMany({ where: { entity }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
    return rows.map(toDef);
  }),

  async listAll() {
    return prisma.customFieldDefinition.findMany({ orderBy: [{ entity: "asc" }, { sortOrder: "asc" }, { label: "asc" }] });
  },

  async get(id: string) {
    return prisma.customFieldDefinition.findUnique({ where: { id } });
  },

  async create(actor: Actor, input: CustomFieldDefinitionInput) {
    assertCan(actor, "settings.manage");
    const existing = await prisma.customFieldDefinition.findUnique({ where: { entity_key: { entity: input.entity, key: input.key } } });
    if (existing) throw new SettingsError("A field with that key already exists for this entity.", "key");
    const row = await prisma.customFieldDefinition.create({ data: toData(input) });
    await logActivity(actor, { entityType: "settings", entityId: row.id, action: "custom_field_created", summary: `Added custom field "${row.label}" on ${row.entity}` });
    return row;
  },

  async update(actor: Actor, id: string, input: CustomFieldDefinitionInput) {
    assertCan(actor, "settings.manage");
    const before = await prisma.customFieldDefinition.findUniqueOrThrow({ where: { id } });
    if (before.entity !== input.entity || before.key !== input.key) {
      throw new SettingsError("Entity and key cannot change; create a new field instead.", "key");
    }
    const row = await prisma.customFieldDefinition.update({ where: { id }, data: toData(input) });
    await logActivity(actor, { entityType: "settings", entityId: row.id, action: "custom_field_updated", summary: `Updated custom field "${row.label}" on ${row.entity}` });
    return row;
  },

  async remove(actor: Actor, id: string) {
    assertCan(actor, "settings.manage");
    const row = await prisma.customFieldDefinition.delete({ where: { id } });
    await logActivity(actor, { entityType: "settings", entityId: id, action: "custom_field_deleted", summary: `Deleted custom field "${row.label}" on ${row.entity}` });
  },
};

function toData(input: CustomFieldDefinitionInput) {
  const options = input.type === "select" ? (input.optionsText ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
  return {
    entity: input.entity,
    key: input.key,
    label: input.label,
    type: input.type,
    options,
    required: input.required,
    sortOrder: input.sortOrder,
  };
}

/* ------------------------------------------------------------------------ */
/* Webhooks + outbox                                                        */
/* ------------------------------------------------------------------------ */

export const webhooks = {
  async list() {
    return prisma.webhook.findMany({ orderBy: { name: "asc" } });
  },
  async create(actor: Actor, input: WebhookInput) {
    assertCan(actor, "settings.manage");
    const events = input.events.filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
    const row = await prisma.webhook.create({ data: { name: input.name, url: input.url, secret: input.secret, events, active: input.active } });
    await logActivity(actor, { entityType: "settings", entityId: row.id, action: "webhook_created", summary: `Added webhook "${row.name}"` });
    return row;
  },
  async update(actor: Actor, id: string, input: WebhookInput) {
    assertCan(actor, "settings.manage");
    const events = input.events.filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
    const row = await prisma.webhook.update({ where: { id }, data: { name: input.name, url: input.url, secret: input.secret, events, active: input.active } });
    await logActivity(actor, { entityType: "settings", entityId: row.id, action: "webhook_updated", summary: `Updated webhook "${row.name}"` });
    return row;
  },
  async remove(actor: Actor, id: string) {
    assertCan(actor, "settings.manage");
    const row = await prisma.webhook.delete({ where: { id } });
    await logActivity(actor, { entityType: "settings", entityId: id, action: "webhook_deleted", summary: `Deleted webhook "${row.name}"` });
  },
};

export const outboxAdmin = {
  async recent(limit = 30) {
    return prisma.outbox.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  },
  async counts() {
    const rows = await prisma.outbox.groupBy({ by: ["status"], _count: { _all: true } });
    return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Record<string, number>;
  },
  async retry(actor: Actor, id: string) {
    assertCan(actor, "settings.manage");
    await prisma.outbox.update({ where: { id }, data: { status: "pending", nextRunAt: new Date(), attempts: 0 } });
  },
};
