import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { dateFromString, dateToString, today, zonedInputToDate, type DateString } from "@/lib/dates";
import { defaultAnchor, materialiseTemplate, templateFromPlan } from "./logic";
import type { LogisticsInput, PlanInput, PlanTemplateInput, ScheduleEntryInput, TaskInput, TemplateEntryInput } from "./schema";

export class PlanError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "PlanError";
  }
}

async function loadPlan(planId: string) {
  const plan = await prisma.productionPlan.findUnique({ where: { id: planId }, include: { project: { select: { id: true, name: true } } } });
  if (!plan) throw new PlanError("Plan not found.");
  return plan;
}

async function log(actor: Actor, projectId: string, action: string, summary: string) {
  await logActivity(actor, { entityType: "project", entityId: projectId, action, summary });
}

/* ------------------------------------------------------------------------ */
/* Plans                                                                    */
/* ------------------------------------------------------------------------ */

export const plans = {
  /** The project's plan, created on first use (optionally from a template). */
  async ensure(actor: Actor, projectId: string, opts: { templateId?: string; anchorDate?: DateString } = {}) {
    assertCan(actor, "plans.write");
    const existing = await prisma.productionPlan.findUnique({ where: { projectId } });
    if (existing) return existing;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new PlanError("Project not found.");
    const plan = await prisma.productionPlan.create({ data: { projectId } });
    await log(actor, projectId, "plan_created", `Created the production plan for ${project.name}`);
    if (opts.templateId) await plans.applyTemplate(actor, plan.id, opts.templateId, opts.anchorDate ?? defaultAnchor(project, today()));
    return plan;
  },

  async update(actor: Actor, planId: string, input: PlanInput) {
    assertCan(actor, "plans.write");
    const plan = await loadPlan(planId);
    const updated = await prisma.productionPlan.update({ where: { id: planId }, data: { notes: input.notes ?? null } });
    await log(actor, plan.projectId, "plan_updated", `Updated plan notes for ${plan.project.name}`);
    return updated;
  },

  async remove(actor: Actor, planId: string) {
    assertCan(actor, "plans.write");
    const plan = await loadPlan(planId);
    await prisma.shareLink.deleteMany({ where: { targetType: "plan", targetId: planId } });
    await prisma.productionPlan.delete({ where: { id: planId } });
    await log(actor, plan.projectId, "plan_deleted", `Deleted the production plan for ${plan.project.name}`);
  },

  /** Add a template's entries to the plan, dated around the anchor day. */
  async applyTemplate(actor: Actor, planId: string, templateId: string, anchorDate: DateString) {
    assertCan(actor, "plans.write");
    const plan = await loadPlan(planId);
    const template = await prisma.planTemplate.findUnique({ where: { id: templateId }, include: { entries: { orderBy: { sortOrder: "asc" } } } });
    if (!template) throw new PlanError("Template not found.", "templateId");
    const m = materialiseTemplate(template.entries, anchorDate);
    const base = await nextSort(planId);
    await prisma.$transaction(async (tx) => {
      if (m.schedule.length) await tx.scheduleEntry.createMany({ data: m.schedule.map((s, i) => ({ planId, startsAt: s.startsAt, durationMin: s.durationMin, title: s.title, location: s.location, notes: s.notes, sortOrder: base + i })) });
      if (m.tasks.length) await tx.planTask.createMany({ data: m.tasks.map((t, i) => ({ planId, phase: t.phase, title: t.title, dueDate: t.dueDate ? dateFromString(t.dueDate) : null, notes: t.notes, sortOrder: base + i })) });
      if (m.logistics.length) await tx.logisticsEntry.createMany({ data: m.logistics.map((l, i) => ({ planId, kind: l.kind, title: l.title, details: l.details, at: l.at, sortOrder: base + i })) });
    });
    await log(actor, plan.projectId, "plan_template_applied", `Applied plan template "${template.name}" to ${plan.project.name}`);
    return { schedule: m.schedule.length, tasks: m.tasks.length, logistics: m.logistics.length };
  },

  /** Save the plan's entries as a reusable template, relative to the anchor day. */
  async saveAsTemplate(actor: Actor, planId: string, name: string, anchorDate: DateString) {
    assertCan(actor, "plans.write");
    const plan = await prisma.productionPlan.findUnique({
      where: { id: planId },
      include: { project: { select: { id: true, name: true } }, schedule: { orderBy: [{ startsAt: "asc" }, { sortOrder: "asc" }] }, tasks: { orderBy: { sortOrder: "asc" } }, logistics: { orderBy: { sortOrder: "asc" } } },
    });
    if (!plan) throw new PlanError("Plan not found.");
    const entries = templateFromPlan(
      {
        schedule: plan.schedule,
        tasks: plan.tasks.map((t) => ({ ...t, dueDate: t.dueDate ? dateToString(t.dueDate) : null })),
        logistics: plan.logistics,
      },
      anchorDate,
    );
    const template = await prisma.planTemplate.create({
      data: { name, entries: { create: entries.map((e, i) => ({ ...e, sortOrder: i })) } },
    });
    await log(actor, plan.projectId, "plan_template_created", `Saved plan template "${name}" from ${plan.project.name}`);
    return template;
  },
};

async function nextSort(planId: string) {
  const [s, t, l] = await Promise.all([
    prisma.scheduleEntry.aggregate({ where: { planId }, _max: { sortOrder: true } }),
    prisma.planTask.aggregate({ where: { planId }, _max: { sortOrder: true } }),
    prisma.logisticsEntry.aggregate({ where: { planId }, _max: { sortOrder: true } }),
  ]);
  return Math.max(s._max.sortOrder ?? 0, t._max.sortOrder ?? 0, l._max.sortOrder ?? 0) + 1;
}

/* ------------------------------------------------------------------------ */
/* Schedule                                                                 */
/* ------------------------------------------------------------------------ */

function scheduleData(input: ScheduleEntryInput) {
  return {
    startsAt: zonedInputToDate(`${input.date}T${input.time}`),
    durationMin: input.durationMin ?? null,
    title: input.title,
    location: input.location ?? null,
    responsibleId: input.responsibleId ?? null,
    notes: input.notes ?? null,
  };
}

export const schedule = {
  async add(actor: Actor, planId: string, input: ScheduleEntryInput) {
    assertCan(actor, "plans.write");
    const plan = await loadPlan(planId);
    const row = await prisma.scheduleEntry.create({ data: { planId, ...scheduleData(input), sortOrder: await nextSort(planId) } });
    await log(actor, plan.projectId, "schedule_added", `${plan.project.name}: added "${row.title}" to the schedule`);
    return row;
  },
  async update(actor: Actor, id: string, input: ScheduleEntryInput) {
    assertCan(actor, "plans.write");
    const row = await prisma.scheduleEntry.update({ where: { id }, data: scheduleData(input), include: { plan: { include: { project: { select: { name: true } } } } } });
    await log(actor, row.plan.projectId, "schedule_updated", `${row.plan.project.name}: updated "${row.title}"`);
    return row;
  },
  async remove(actor: Actor, id: string) {
    assertCan(actor, "plans.write");
    const row = await prisma.scheduleEntry.delete({ where: { id }, include: { plan: { include: { project: { select: { name: true } } } } } });
    await log(actor, row.plan.projectId, "schedule_removed", `${row.plan.project.name}: removed "${row.title}" from the schedule`);
  },
};

/* ------------------------------------------------------------------------ */
/* Tasks                                                                    */
/* ------------------------------------------------------------------------ */

function taskData(input: TaskInput) {
  return {
    phase: input.phase,
    title: input.title,
    assigneeId: input.assigneeId ?? null,
    dueDate: input.dueDate ? dateFromString(input.dueDate) : null,
    notes: input.notes ?? null,
  };
}

export const tasks = {
  async add(actor: Actor, planId: string, input: TaskInput) {
    assertCan(actor, "plans.write");
    const plan = await loadPlan(planId);
    const row = await prisma.planTask.create({ data: { planId, ...taskData(input), sortOrder: await nextSort(planId) } });
    await log(actor, plan.projectId, "task_added", `${plan.project.name}: added task "${row.title}"`);
    return row;
  },
  async update(actor: Actor, id: string, input: TaskInput) {
    assertCan(actor, "plans.write");
    const row = await prisma.planTask.update({ where: { id }, data: taskData(input), include: { plan: { include: { project: { select: { name: true } } } } } });
    await log(actor, row.plan.projectId, "task_updated", `${row.plan.project.name}: updated task "${row.title}"`);
    return row;
  },
  async setDone(actor: Actor, id: string, done: boolean) {
    assertCan(actor, "plans.write");
    const row = await prisma.planTask.update({ where: { id }, data: { done, doneAt: done ? new Date() : null }, include: { plan: { include: { project: { select: { name: true } } } } } });
    await log(actor, row.plan.projectId, done ? "task_done" : "task_reopened", `${row.plan.project.name}: ${done ? "done" : "reopened"} "${row.title}"`);
    return row;
  },
  async remove(actor: Actor, id: string) {
    assertCan(actor, "plans.write");
    const row = await prisma.planTask.delete({ where: { id }, include: { plan: { include: { project: { select: { name: true } } } } } });
    await log(actor, row.plan.projectId, "task_removed", `${row.plan.project.name}: removed task "${row.title}"`);
  },
};

/* ------------------------------------------------------------------------ */
/* Logistics                                                                */
/* ------------------------------------------------------------------------ */

function logisticsData(input: LogisticsInput) {
  return { kind: input.kind, title: input.title, details: input.details ?? null, at: input.at ? zonedInputToDate(input.at) : null };
}

export const logistics = {
  async add(actor: Actor, planId: string, input: LogisticsInput) {
    assertCan(actor, "plans.write");
    const plan = await loadPlan(planId);
    const row = await prisma.logisticsEntry.create({ data: { planId, ...logisticsData(input), sortOrder: await nextSort(planId) } });
    await log(actor, plan.projectId, "logistics_added", `${plan.project.name}: added logistics "${row.title}"`);
    return row;
  },
  async update(actor: Actor, id: string, input: LogisticsInput) {
    assertCan(actor, "plans.write");
    const row = await prisma.logisticsEntry.update({ where: { id }, data: logisticsData(input), include: { plan: { include: { project: { select: { name: true } } } } } });
    await log(actor, row.plan.projectId, "logistics_updated", `${row.plan.project.name}: updated logistics "${row.title}"`);
    return row;
  },
  async remove(actor: Actor, id: string) {
    assertCan(actor, "plans.write");
    const row = await prisma.logisticsEntry.delete({ where: { id }, include: { plan: { include: { project: { select: { name: true } } } } } });
    await log(actor, row.plan.projectId, "logistics_removed", `${row.plan.project.name}: removed logistics "${row.title}"`);
  },
};

/* ------------------------------------------------------------------------ */
/* Templates                                                                */
/* ------------------------------------------------------------------------ */

function entryData(input: TemplateEntryInput) {
  return {
    kind: input.kind,
    dayOffset: input.dayOffset,
    time: input.kind === "task" ? null : (input.time ?? null),
    durationMin: input.kind === "schedule" ? (input.durationMin ?? null) : null,
    title: input.title,
    location: input.kind === "schedule" ? (input.location ?? null) : null,
    phase: input.kind === "task" ? (input.phase ?? "pre_production") : null,
    logisticsKind: input.kind === "logistics" ? (input.logisticsKind ?? "other") : null,
    notes: input.notes ?? null,
  };
}

export const planTemplates = {
  async create(actor: Actor, input: PlanTemplateInput) {
    assertCan(actor, "plans.write");
    const t = await prisma.planTemplate.create({ data: { name: input.name, description: input.description ?? null } });
    await logActivity(actor, { entityType: "settings", entityId: t.id, action: "plan_template_created", summary: `Created plan template "${t.name}"` });
    return t;
  },
  async update(actor: Actor, id: string, input: PlanTemplateInput) {
    assertCan(actor, "plans.write");
    return prisma.planTemplate.update({ where: { id }, data: { name: input.name, description: input.description ?? null } });
  },
  async remove(actor: Actor, id: string) {
    assertCan(actor, "plans.write");
    const t = await prisma.planTemplate.delete({ where: { id } });
    await logActivity(actor, { entityType: "settings", entityId: id, action: "plan_template_deleted", summary: `Deleted plan template "${t.name}"` });
  },
  async addEntry(actor: Actor, templateId: string, input: TemplateEntryInput) {
    assertCan(actor, "plans.write");
    const last = await prisma.planTemplateEntry.findFirst({ where: { templateId }, orderBy: { sortOrder: "desc" } });
    return prisma.planTemplateEntry.create({ data: { templateId, ...entryData(input), sortOrder: (last?.sortOrder ?? 0) + 1 } });
  },
  async updateEntry(actor: Actor, id: string, input: TemplateEntryInput) {
    assertCan(actor, "plans.write");
    return prisma.planTemplateEntry.update({ where: { id }, data: entryData(input) });
  },
  async removeEntry(actor: Actor, id: string) {
    assertCan(actor, "plans.write");
    await prisma.planTemplateEntry.delete({ where: { id } });
  },
};
