import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { dateToString, type DateString } from "@/lib/dates";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { listsForProject } from "@/modules/packing/queries";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { projectContactRow, projectContactsInclude } from "@/modules/projects/queries";
import type { LogisticsKind, PlanPhase } from "../../../config/app.config";
import { endTime, groupByDay, sortTasks, taskProgress, timeOfDay } from "./logic";

export type ScheduleRow = {
  id: string;
  startsAt: Date;
  day: DateString;
  time: string;
  endTime: string | null;
  durationMin: number | null;
  title: string;
  location: string | null;
  responsibleId: string | null;
  responsibleName: string | null;
  notes: string | null;
  sortOrder: number;
};

export type TaskRow = {
  id: string;
  phase: PlanPhase;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: DateString | null;
  done: boolean;
  doneAt: Date | null;
  notes: string | null;
  sortOrder: number;
};

export type LogisticsRow = { id: string; kind: LogisticsKind; title: string; details: string | null; at: Date | null; sortOrder: number };

export type PlanDetail = NonNullable<Awaited<ReturnType<typeof planDetailById>>>;

const planInclude = {
  project: { include: { client: { select: { name: true } }, contacts: projectContactsInclude, crew: { include: { user: { select: { id: true, name: true, email: true, phone: true } } }, orderBy: { user: { name: "asc" as const } } } } },
  schedule: { include: { responsible: { select: { name: true } } }, orderBy: [{ startsAt: "asc" as const }, { sortOrder: "asc" as const }] },
  tasks: { include: { assignee: { select: { name: true } } }, orderBy: { sortOrder: "asc" as const } },
  logistics: { orderBy: [{ at: "asc" as const }, { sortOrder: "asc" as const }] },
};

/** Everything the plan page, the share page and the PDFs need. */
export async function planDetailById(planId: string) {
  const plan = await prisma.productionPlan.findUnique({ where: { id: planId }, include: planInclude });
  if (!plan) return null;
  return shape(plan);
}

export async function planDetail(projectId: string) {
  const plan = await prisma.productionPlan.findUnique({ where: { projectId }, include: planInclude });
  if (!plan) return null;
  return shape(plan);
}

type PlanRow = Prisma.ProductionPlanGetPayload<{ include: typeof planInclude }>;

async function shape(plan: PlanRow) {
  const p = plan.project;
  const schedule: ScheduleRow[] = plan.schedule.map((s) => ({
    id: s.id,
    startsAt: s.startsAt,
    day: timeOfDayDay(s.startsAt),
    time: timeOfDay(s.startsAt),
    endTime: endTime(s.startsAt, s.durationMin),
    durationMin: s.durationMin,
    title: s.title,
    location: s.location,
    responsibleId: s.responsibleId,
    responsibleName: s.responsible?.name ?? null,
    notes: s.notes,
    sortOrder: s.sortOrder,
  }));
  const tasks: TaskRow[] = sortTasks(
    plan.tasks.map((t) => ({
      id: t.id,
      phase: t.phase as PlanPhase,
      title: t.title,
      assigneeId: t.assigneeId,
      assigneeName: t.assignee?.name ?? null,
      dueDate: t.dueDate ? dateToString(t.dueDate) : null,
      done: t.done,
      doneAt: t.doneAt,
      notes: t.notes,
      sortOrder: t.sortOrder,
    })),
  );
  const logistics: LogisticsRow[] = plan.logistics.map((l) => ({ id: l.id, kind: l.kind as LogisticsKind, title: l.title, details: l.details, at: l.at, sortOrder: l.sortOrder }));
  const packingLists = await listsForProject(p.id);
  return {
    plan: { id: plan.id, projectId: plan.projectId, notes: plan.notes, createdAt: plan.createdAt, updatedAt: plan.updatedAt },
    project: {
      id: p.id,
      name: p.name,
      status: p.status,
      clientName: p.client?.name ?? null,
      venueName: p.venueName,
      venueAddress: p.venueAddress,
      prepStart: p.prepStart,
      prepEnd: p.prepEnd,
      buildStart: p.buildStart,
      buildEnd: p.buildEnd,
      buildCall: p.buildCall,
      showStart: p.showStart,
      showEnd: p.showEnd,
      packStart: p.packStart,
      packEnd: p.packEnd,
      packCall: p.packCall,
      returnDate: p.returnDate,
      notes: p.notes,
      externalLinks: Array.isArray(p.externalLinks) ? (p.externalLinks as { label: string; url: string }[]) : [],
    },
    schedule,
    days: groupByDay(schedule),
    tasks,
    taskProgress: taskProgress(tasks),
    logistics,
    crew: p.crew.map((c) => ({ id: c.id, userId: c.userId, name: c.user.name, email: c.user.email, phone: c.user.phone, role: c.role, callTime: c.callTime, notes: c.notes })),
    contacts: p.contacts.map(projectContactRow),
    packingLists,
  };
}

function timeOfDayDay(d: Date): DateString {
  // groupByDay uses dayInZone; keep the same day key on each row for the day-sheet filter.
  return groupByDay([{ startsAt: d, durationMin: null }])[0].day;
}

/** Does the project have a plan? (project page) */
export async function planSummary(projectId: string) {
  const plan = await prisma.productionPlan.findUnique({ where: { projectId }, include: { _count: { select: { schedule: true, tasks: true, logistics: true } }, tasks: { select: { done: true } } } });
  if (!plan) return null;
  return { id: plan.id, schedule: plan._count.schedule, tasks: plan._count.tasks, tasksDone: plan.tasks.filter((t) => t.done).length, logistics: plan._count.logistics };
}

export async function planTemplateOptions() {
  return prisma.planTemplate.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { entries: true } } } });
}

export async function planTemplateDetail(id: string) {
  return prisma.planTemplate.findUnique({ where: { id }, include: { entries: { orderBy: [{ dayOffset: "asc" }, { time: "asc" }, { sortOrder: "asc" }] } } });
}
