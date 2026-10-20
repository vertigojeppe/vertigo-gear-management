import type { PrismaClient } from "../../src/generated/prisma/client";
import { addDays, dateFromString, dayInZone, zonedInputToDate } from "../../src/lib/dates";

/**
 * One plan template ("Festival laser show") and a production plan on the
 * Roskilde project built from it, anchored on the project's load-in day.
 */
type Entry = { kind: "schedule" | "task" | "logistics"; dayOffset: number; time?: string; durationMin?: number; title: string; location?: string; phase?: string; logisticsKind?: string; notes?: string };

const TEMPLATE = {
  name: "Festival laser show",
  description: "Two-day festival build with lasers: load-in day 0, show day 1, strike and return day 2.",
  entries: [
    { kind: "schedule", dayOffset: -1, time: "08:00", durationMin: 120, title: "Load truck at warehouse", location: "Warehouse" },
    { kind: "schedule", dayOffset: 0, time: "08:00", durationMin: 60, title: "Load-in", location: "Dock" },
    { kind: "schedule", dayOffset: 0, time: "09:00", durationMin: 240, title: "Rig truss and hang fixtures", location: "Stage" },
    { kind: "schedule", dayOffset: 0, time: "14:00", durationMin: 120, title: "Cable and power" },
    { kind: "schedule", dayOffset: 0, time: "16:00", durationMin: 180, title: "Focus and laser alignment", notes: "Laser zones checked with venue safety." },
    { kind: "schedule", dayOffset: 0, time: "19:00", durationMin: 180, title: "Programming", location: "FOH" },
    { kind: "schedule", dayOffset: 1, time: "14:00", durationMin: 120, title: "Tech run" },
    { kind: "schedule", dayOffset: 1, time: "21:00", durationMin: 90, title: "Show" },
    { kind: "schedule", dayOffset: 1, time: "23:00", durationMin: 180, title: "Strike" },
    { kind: "schedule", dayOffset: 2, time: "10:00", durationMin: 120, title: "Return gear and check in", location: "Warehouse" },
    { kind: "task", dayOffset: -10, title: "Send laser safety form to venue", phase: "pre_production" },
    { kind: "task", dayOffset: -7, title: "Confirm power with venue (32 A)", phase: "pre_production" },
    { kind: "task", dayOffset: -5, title: "Book van", phase: "pre_production" },
    { kind: "task", dayOffset: -2, title: "Pack and check out", phase: "pre_production" },
    { kind: "task", dayOffset: 0, title: "Laser zone check with venue safety", phase: "build" },
    { kind: "task", dayOffset: 1, title: "Brief security on laser zones", phase: "show" },
    { kind: "task", dayOffset: 2, title: "Check in all gear", phase: "post" },
    { kind: "task", dayOffset: 3, title: "Report damages and missing items", phase: "post" },
    { kind: "logistics", dayOffset: -1, time: "07:00", title: "Van 3.5 t", logisticsKind: "vehicle", notes: "Pick up at rental, return day 2 before 18:00." },
    { kind: "logistics", dayOffset: 0, title: "Backstage parking, 2 spots", logisticsKind: "parking" },
    { kind: "logistics", dayOffset: 0, time: "08:00", title: "Dock B, ramp, 2.2 m clearance", logisticsKind: "loading" },
    { kind: "logistics", dayOffset: 0, title: "Crew hotel", logisticsKind: "hotel", notes: "2 rooms, 2 nights." },
  ] as Entry[],
};

export async function seedPlans(prisma: PrismaClient) {
  const existing = await prisma.planTemplate.findFirst({ where: { name: TEMPLATE.name } });
  const template = existing
    ? await prisma.planTemplate.update({ where: { id: existing.id }, data: { description: TEMPLATE.description } })
    : await prisma.planTemplate.create({ data: { name: TEMPLATE.name, description: TEMPLATE.description } });
  if ((await prisma.planTemplateEntry.count({ where: { templateId: template.id } })) === 0) {
    await prisma.planTemplateEntry.createMany({
      data: TEMPLATE.entries.map((e, i) => ({ templateId: template.id, kind: e.kind, dayOffset: e.dayOffset, time: e.time ?? null, durationMin: e.durationMin ?? null, title: e.title, location: e.location ?? null, phase: e.phase ?? null, logisticsKind: e.logisticsKind ?? null, notes: e.notes ?? null, sortOrder: i })),
    });
  }

  let plans = 0;
  const roskilde = await prisma.project.findFirst({ where: { name: "Roskilde Festival – Orange stage" }, include: { crew: true } });
  if (roskilde && !(await prisma.productionPlan.findUnique({ where: { projectId: roskilde.id } }))) {
    const anchor = dayInZone(roskilde.buildStart ?? roskilde.showStart ?? new Date());
    const plan = await prisma.productionPlan.create({ data: { projectId: roskilde.id, notes: "Laser zones agreed with festival safety on the phone; written confirmation pending." } });
    const responsible = roskilde.crew[0]?.userId ?? null;
    let i = 0;
    for (const e of TEMPLATE.entries) {
      const day = addDays(anchor, e.dayOffset);
      if (e.kind === "schedule") {
        await prisma.scheduleEntry.create({ data: { planId: plan.id, startsAt: zonedInputToDate(`${day}T${e.time ?? "09:00"}`), durationMin: e.durationMin ?? null, title: e.title, location: e.location ?? null, responsibleId: i % 2 === 0 ? responsible : null, notes: e.notes ?? null, sortOrder: i } });
      } else if (e.kind === "task") {
        await prisma.planTask.create({ data: { planId: plan.id, phase: e.phase ?? "pre_production", title: e.title, dueDate: dateFromString(day), done: e.dayOffset <= -5, doneAt: e.dayOffset <= -5 ? new Date() : null, assigneeId: responsible, sortOrder: i } });
      } else {
        await prisma.logisticsEntry.create({ data: { planId: plan.id, kind: e.logisticsKind ?? "other", title: e.title, details: e.notes ?? null, at: e.time ? zonedInputToDate(`${day}T${e.time}`) : null, sortOrder: i } });
      }
      i++;
    }
    plans++;
  }
  return { templates: 1, plans };
}
