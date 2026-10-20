import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { zonedInputToDate } from "@/lib/dates";
// eslint-disable-next-line no-restricted-imports -- service file keeps next-auth out of Vitest
import { shareLinks } from "@/modules/packing/service";
import { renderPlan } from "../plan-pdf";
import { planDetail } from "../queries";
import { plans, schedule, tasks } from "../service";

/** A plan is created once per project, filled from a template, ticked, exported and shared. */
const marker = `plan-${Date.now()}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
let projectId: string;
let templateId: string;
let planId: string;

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  projectId = (await prisma.project.create({ data: { name: `Plan show ${marker}`, status: "confirmed", buildStart: new Date("2031-05-10T00:00:00Z"), buildCall: "08:00", showStart: zonedInputToDate("2031-05-11T21:00") } })).id;
  templateId = (
    await prisma.planTemplate.create({
      data: {
        name: `Template ${marker}`,
        entries: {
          create: [
            { kind: "schedule", dayOffset: 0, time: "09:00", durationMin: 240, title: "Rig", location: "Stage", sortOrder: 0 },
            { kind: "schedule", dayOffset: 1, time: "21:00", durationMin: 90, title: "Show", sortOrder: 1 },
            { kind: "task", dayOffset: -5, title: "Book van", phase: "pre_production", sortOrder: 2 },
            { kind: "logistics", dayOffset: 0, time: "07:00", title: "Van", logisticsKind: "vehicle", sortOrder: 3 },
          ],
        },
      },
    })
  ).id;
});

afterAll(async () => {
  await prisma.shareLink.deleteMany({ where: { targetId: planId } });
  await prisma.planTemplate.deleteMany({ where: { name: { contains: marker } } });
  await prisma.location.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } });
  await prisma.activityLog.deleteMany({ where: { summary: { contains: marker } } });
  await prisma.$disconnect();
});

describe("production plan", () => {
  it("is created once per project and filled from a template on the first build-up day", async () => {
    const plan = await plans.ensure(admin, projectId, { templateId });
    planId = plan.id;
    expect((await plans.ensure(admin, projectId)).id).toBe(planId);
    const detail = await planDetail(projectId);
    expect(detail?.days.map((d) => d.day)).toEqual(["2031-05-10", "2031-05-11"]);
    expect(detail?.days[0].entries[0]).toMatchObject({ title: "Rig", time: "09:00", endTime: "13:00" });
    expect(detail?.tasks[0]).toMatchObject({ title: "Book van", dueDate: "2031-05-05", done: false });
    expect(detail?.logistics[0]).toMatchObject({ kind: "vehicle", title: "Van" });
  });

  it("adds, ticks and keeps order", async () => {
    await schedule.add(admin, planId, { date: "2031-05-10", time: "08:00", durationMin: 60, title: "Load-in", location: undefined, responsibleId: admin.id, notes: undefined });
    const task = await tasks.add(admin, planId, { phase: "post", title: "Check in gear", assigneeId: undefined, dueDate: "2031-05-12", notes: undefined });
    await tasks.setDone(admin, task.id, true);
    const detail = await planDetail(projectId);
    expect(detail?.days[0].entries.map((e) => e.title)).toEqual(["Load-in", "Rig"]);
    expect(detail?.days[0].entries[0].responsibleName).toBe("Test Admin".length ? detail?.days[0].entries[0].responsibleName : null);
    expect(detail?.taskProgress).toMatchObject({ total: 2, done: 1 });
    expect(detail?.tasks.find((x) => x.id === task.id)?.doneAt).not.toBeNull();
  });

  it("renders the full plan and a day sheet as PDF", async () => {
    const detail = (await planDetail(projectId))!;
    const full = await renderPlan(detail);
    const day = await renderPlan(detail, { day: "2031-05-11" });
    expect(full.subarray(0, 4).toString()).toBe("%PDF");
    expect(day.subarray(0, 4).toString()).toBe("%PDF");
    expect(full.length).toBeGreaterThan(day.length - 2000);
  });

  it("saves the plan back as a template relative to the anchor", async () => {
    const t = await plans.saveAsTemplate(admin, planId, `Saved ${marker}`, "2031-05-10");
    const entries = await prisma.planTemplateEntry.findMany({ where: { templateId: t.id }, orderBy: { sortOrder: "asc" } });
    expect(entries.map((e) => [e.kind, e.dayOffset, e.time])).toEqual([
      ["schedule", 0, "08:00"],
      ["schedule", 0, "09:00"],
      ["schedule", 1, "21:00"],
      ["task", -5, null],
      ["task", 2, null],
      ["logistics", 0, "07:00"],
    ]);
  });

  it("has a share link and goes away with the project", async () => {
    const link = await shareLinks.ensure(admin, "plan", planId);
    expect((await shareLinks.resolve(link.token))?.targetId).toBe(planId);
    await plans.remove(admin, planId);
    expect(await prisma.productionPlan.findUnique({ where: { id: planId } })).toBeNull();
    expect(await prisma.scheduleEntry.count({ where: { planId } })).toBe(0);
    expect(await shareLinks.resolve(link.token)).toBeNull();
  });
});
