import { prisma } from "@/lib/db";
import { addDays, dateToString, dayInZone, today, type DateString } from "@/lib/dates";
import { PROJECT_STATUSES, type PlanPhase } from "../../../config/app.config";
import { endTime, timeOfDay } from "./logic";

/** Projects that still matter: anything not done or cancelled. */
const ACTIVE = PROJECT_STATUSES.filter((s) => s.key !== "done" && s.key !== "cancelled").map((s) => s.key);

export type MyScheduleRow = {
  id: string;
  projectId: string;
  projectName: string;
  day: DateString;
  time: string;
  endTime: string | null;
  title: string;
  location: string | null;
  /** True when this entry names me as responsible (otherwise it is on a project I crew). */
  mine: boolean;
  responsibleName: string | null;
  /** Where the row links to, when it is not a plan entry (a meeting, time off, an assignment). "" time = all day. */
  href?: string;
};

export type MyTaskRow = {
  id: string;
  projectId: string;
  planId: string;
  projectName: string;
  phase: PlanPhase;
  title: string;
  dueDate: DateString | null;
  overdue: boolean;
  dueSoon: boolean;
  notes: string | null;
};

export type MyProjectRow = {
  id: string;
  name: string;
  role: string | null;
  callTime: Date | null;
  reserveFrom: DateString | null;
  reserveTo: DateString | null;
  venueName: string | null;
  /** The production plan, when one exists (for the "my plan" PDF). */
  planId: string | null;
};

export type MyDay = {
  today: DateString;
  /** Entries today and tomorrow on my projects, or where I am responsible. */
  schedule: MyScheduleRow[];
  /** Open tasks assigned to me, due first (overdue on top), then undated. */
  tasks: MyTaskRow[];
  /** Active projects I am crew on, starting within a week or running now. */
  projects: MyProjectRow[];
};

/**
 * What one person needs to see this morning: today's and tomorrow's
 * schedule on their projects, their open tasks, and the projects they are
 * booked on this week with their call times. "My projects" = the ones
 * where I am on the crew; schedule entries that name me as responsible
 * count even when I am not on the crew list.
 */
export async function myDay(userId: string, days = 7): Promise<MyDay> {
  const t = today();
  const tomorrow = addDays(t, 1);
  const weekEnd = addDays(t, days);
  const dayStart = new Date(`${t}T00:00:00Z`);

  const crew = await prisma.projectCrew.findMany({
    where: { userId, project: { status: { in: ACTIVE } } },
    include: { project: { select: { id: true, name: true, status: true, reserveFrom: true, reserveTo: true, venueName: true, plan: { select: { id: true } } } } },
  });
  const myProjectIds = crew.map((c) => c.projectId);

  // Entries are found by the Copenhagen day; the UTC window below is wide enough to cover both days in any offset.
  const from = new Date(`${t}T00:00:00Z`);
  from.setUTCHours(from.getUTCHours() - 3);
  const to = new Date(`${tomorrow}T23:59:59Z`);
  to.setUTCHours(to.getUTCHours() + 3);
  const [entries, openTasks] = await Promise.all([
    prisma.scheduleEntry.findMany({
      where: { startsAt: { gte: from, lte: to }, OR: [{ responsibleId: userId }, { plan: { projectId: { in: myProjectIds } } }], plan: { project: { status: { in: ACTIVE } } } },
      include: { responsible: { select: { name: true } }, plan: { select: { project: { select: { id: true, name: true } } } } },
      orderBy: [{ startsAt: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.planTask.findMany({
      where: { assigneeId: userId, done: false, plan: { project: { status: { in: ACTIVE } } } },
      include: { plan: { select: { id: true, project: { select: { id: true, name: true } } } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }],
    }),
  ]);

  const schedule: MyScheduleRow[] = entries
    .map((e) => ({
      id: e.id,
      projectId: e.plan.project.id,
      projectName: e.plan.project.name,
      day: dayInZone(e.startsAt),
      time: timeOfDay(e.startsAt),
      endTime: endTime(e.startsAt, e.durationMin),
      title: e.title,
      location: e.location,
      mine: e.responsibleId === userId,
      responsibleName: e.responsible?.name ?? null,
    }))
    .filter((e) => e.day === t || e.day === tomorrow);

  const tasks: MyTaskRow[] = openTasks.map((task) => {
    const due = task.dueDate ? dateToString(task.dueDate) : null;
    return {
      id: task.id,
      projectId: task.plan.project.id,
      planId: task.plan.id,
      projectName: task.plan.project.name,
      phase: task.phase as PlanPhase,
      title: task.title,
      dueDate: due,
      overdue: due !== null && due < t,
      dueSoon: due !== null && due >= t && due <= weekEnd,
      notes: task.notes,
    };
  });

  const projects: MyProjectRow[] = crew
    .filter((c) => {
      const p = c.project;
      const startsSoon = p.reserveFrom ? dateToString(p.reserveFrom) <= weekEnd : false;
      const notOver = p.reserveTo ? p.reserveTo >= dayStart : true;
      const callSoon = c.callTime ? c.callTime >= dayStart && dayInZone(c.callTime) <= weekEnd : false;
      return (startsSoon && notOver) || callSoon;
    })
    .map((c) => ({
      id: c.project.id,
      name: c.project.name,
      role: c.role,
      callTime: c.callTime,
      reserveFrom: c.project.reserveFrom ? dateToString(c.project.reserveFrom) : null,
      reserveTo: c.project.reserveTo ? dateToString(c.project.reserveTo) : null,
      venueName: c.project.venueName,
      planId: c.project.plan?.id ?? null,
    }))
    .sort((a, b) => (a.callTime?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.callTime?.getTime() ?? Number.MAX_SAFE_INTEGER) || (a.reserveFrom ?? "").localeCompare(b.reserveFrom ?? ""));

  return { today: t, schedule, tasks, projects };
}
