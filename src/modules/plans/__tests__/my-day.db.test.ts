import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addDays, today, zonedInputToDate } from "@/lib/dates";
import { myDay } from "../my-day";

/**
 * Integration test against the dev/CI database: a user on the crew of one
 * project sees that project's schedule for today, their own open tasks
 * (overdue first), and the project with its call time; a project they are
 * not on shows only where they are named responsible.
 */
const marker = `myday-${Date.now().toString(36)}`;
const t = today();
let userId: string;
let otherUserId: string;
let mineId: string;
let otherId: string;
const planIds: string[] = [];

// Copenhagen wall-clock time, summer or winter (a fixed +02:00 broke the test from the last Sunday of October).
const at = (day: string, hhmm: string) => zonedInputToDate(`${day}T${hhmm}`);

beforeAll(async () => {
  userId = (await prisma.user.findFirst({ where: { role: "member" } }))?.id ?? (await prisma.user.findFirstOrThrow()).id;
  otherUserId = (await prisma.user.findFirst({ where: { id: { not: userId } } }))?.id ?? userId;
  const mine = await prisma.project.create({ data: { name: `Mine ${marker}`, status: "confirmed", reserveFrom: new Date(`${t}T00:00:00Z`), reserveTo: new Date(`${addDays(t, 2)}T00:00:00Z`), venueName: "Vega" } });
  const other = await prisma.project.create({ data: { name: `Other ${marker}`, status: "confirmed", reserveFrom: new Date(`${t}T00:00:00Z`), reserveTo: new Date(`${addDays(t, 2)}T00:00:00Z`) } });
  const done = await prisma.project.create({ data: { name: `Done ${marker}`, status: "done" } });
  mineId = mine.id;
  otherId = other.id;
  await prisma.projectCrew.create({ data: { projectId: mine.id, userId, role: "Lights", callTime: at(t, "09:00") } });
  await prisma.projectCrew.create({ data: { projectId: done.id, userId } });
  const mp = await prisma.productionPlan.create({ data: { projectId: mine.id } });
  const op = await prisma.productionPlan.create({ data: { projectId: other.id } });
  const dp = await prisma.productionPlan.create({ data: { projectId: done.id } });
  planIds.push(mp.id, op.id, dp.id);
  await prisma.scheduleEntry.createMany({
    data: [
      { planId: mp.id, startsAt: at(t, "10:00"), durationMin: 120, title: `Rig ${marker}`, location: "Stage" },
      { planId: mp.id, startsAt: at(addDays(t, 1), "08:00"), title: `Focus ${marker}` },
      { planId: mp.id, startsAt: at(addDays(t, 3), "08:00"), title: `Later ${marker}` },
      { planId: op.id, startsAt: at(t, "14:00"), title: `Not mine ${marker}` },
      { planId: op.id, startsAt: at(t, "16:00"), title: `Mine by name ${marker}`, responsibleId: userId },
      { planId: dp.id, startsAt: at(t, "12:00"), title: `Finished ${marker}` },
    ],
  });
  await prisma.planTask.createMany({
    data: [
      { planId: mp.id, title: `Undated ${marker}`, assigneeId: userId },
      { planId: mp.id, title: `Overdue ${marker}`, assigneeId: userId, dueDate: new Date(`${addDays(t, -2)}T00:00:00Z`) },
      { planId: op.id, title: `Soon ${marker}`, assigneeId: userId, dueDate: new Date(`${addDays(t, 3)}T00:00:00Z`) },
      { planId: mp.id, title: `Done task ${marker}`, assigneeId: userId, done: true },
      { planId: mp.id, title: `Someone else ${marker}`, assigneeId: otherUserId === userId ? null : otherUserId },
      { planId: dp.id, title: `Finished task ${marker}`, assigneeId: userId },
    ],
  });
});

afterAll(async () => {
  await prisma.project.deleteMany({ where: { name: { contains: marker } } });
  await prisma.$disconnect();
});

describe("myDay", () => {
  it("collects today's schedule, open tasks and this week's projects for one person", async () => {
    const d = await myDay(userId);
    expect(d.today).toBe(t);

    // Only this test's rows: the seed (fresh in CI) may put the same person on entries today as well.
    const schedule = d.schedule.filter((e) => e.title.includes(marker));
    expect(schedule.map((e) => e.title.replace(` ${marker}`, ""))).toEqual(["Rig", "Mine by name", "Focus"]);
    expect(schedule[0]).toMatchObject({ projectId: mineId, day: t, time: "10:00", endTime: "12:00", location: "Stage", mine: false });
    expect(schedule[1]).toMatchObject({ projectId: otherId, mine: true });

    const tasks = d.tasks.filter((x) => x.title.includes(marker)).map((x) => ({ title: x.title.replace(` ${marker}`, ""), overdue: x.overdue, dueSoon: x.dueSoon }));
    expect(tasks).toEqual([
      { title: "Overdue", overdue: true, dueSoon: false },
      { title: "Soon", overdue: false, dueSoon: true },
      { title: "Undated", overdue: false, dueSoon: false },
    ]);

    const mine = d.projects.find((p) => p.id === mineId);
    expect(mine).toMatchObject({ role: "Lights", venueName: "Vega", reserveFrom: t });
    expect(mine?.callTime?.toISOString()).toBe(at(t, "09:00").toISOString());
    expect(mine?.planId).toBe(planIds[0]);
    expect(d.projects.some((p) => p.id === otherId)).toBe(false);
    expect(d.projects.some((p) => p.name.startsWith("Done"))).toBe(false);
  });
});
