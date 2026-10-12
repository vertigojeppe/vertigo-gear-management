import { describe, expect, it } from "vitest";
import { zonedInputToDate } from "@/lib/dates";
import { dayOffset, defaultAnchor, defaultModelUnit, endTime, formatDistance, groupByDay, materialiseTemplate, sortTasks, taskProgress, templateFromPlan, timeOfDay } from "../logic";

const entries = [
  { kind: "schedule", dayOffset: -1, time: "08:00", durationMin: 120, title: "Load truck", location: "Warehouse", phase: null, logisticsKind: null, notes: null, sortOrder: 0 },
  { kind: "schedule", dayOffset: 0, time: "09:00", durationMin: 240, title: "Rig", location: "Stage", phase: null, logisticsKind: null, notes: null, sortOrder: 1 },
  { kind: "task", dayOffset: -7, time: null, durationMin: null, title: "Confirm power", location: null, phase: "pre_production", logisticsKind: null, notes: null, sortOrder: 2 },
  { kind: "task", dayOffset: 1, time: null, durationMin: null, title: "Brief security", location: null, phase: "nonsense", logisticsKind: null, notes: null, sortOrder: 3 },
  { kind: "logistics", dayOffset: 0, time: "07:30", durationMin: null, title: "Van", location: null, phase: null, logisticsKind: "vehicle", notes: "3.5 t", sortOrder: 4 },
  { kind: "logistics", dayOffset: 0, time: null, durationMin: null, title: "Parking", location: null, phase: null, logisticsKind: "parking", notes: null, sortOrder: 5 },
];

describe("materialiseTemplate", () => {
  it("dates entries around the anchor in Copenhagen time", () => {
    const m = materialiseTemplate(entries, "2030-06-10");
    expect(m.schedule.map((s) => timeOfDay(s.startsAt))).toEqual(["08:00", "09:00"]);
    expect(m.schedule[0].startsAt).toEqual(zonedInputToDate("2030-06-09T08:00"));
    expect(m.schedule[1].startsAt).toEqual(zonedInputToDate("2030-06-10T09:00"));
    expect(m.tasks.map((t) => t.dueDate)).toEqual(["2030-06-03", "2030-06-11"]);
    expect(m.tasks[1].phase).toBe("pre_production"); // unknown phase falls back
    expect(m.logistics[0].at).toEqual(zonedInputToDate("2030-06-10T07:30"));
    expect(m.logistics[1].at).toBeNull();
    expect(m.logistics[0].details).toBe("3.5 t");
  });

  it("round-trips through templateFromPlan", () => {
    const anchor = "2030-06-10";
    const m = materialiseTemplate(entries, anchor);
    const back = templateFromPlan(m, anchor);
    expect(back.map((e) => [e.kind, e.dayOffset, e.time, e.title])).toEqual([
      ["schedule", -1, "08:00", "Load truck"],
      ["schedule", 0, "09:00", "Rig"],
      ["task", -7, null, "Confirm power"],
      ["task", 1, null, "Brief security"],
      ["logistics", 0, "07:30", "Van"],
      ["logistics", 0, null, "Parking"],
    ]);
  });
});

describe("schedule helpers", () => {
  it("groups by Copenhagen day and sorts within the day", () => {
    const late = { startsAt: zonedInputToDate("2030-06-10T23:30"), durationMin: 60, sortOrder: 0 };
    const earlyNext = { startsAt: zonedInputToDate("2030-06-11T00:30"), durationMin: null, sortOrder: 0 };
    const morning = { startsAt: zonedInputToDate("2030-06-10T08:00"), durationMin: 30, sortOrder: 0 };
    const days = groupByDay([late, earlyNext, morning]);
    expect(days.map((d) => d.day)).toEqual(["2030-06-10", "2030-06-11"]);
    expect(days[0].entries).toEqual([morning, late]);
    expect(endTime(late.startsAt, late.durationMin)).toBe("00:30");
    expect(endTime(morning.startsAt, null)).toBeNull();
  });

  it("computes day offsets and the default anchor", () => {
    expect(dayOffset("2030-06-10", "2030-06-12")).toBe(2);
    expect(dayOffset("2030-06-10", "2030-06-08")).toBe(-2);
    expect(defaultAnchor({ loadIn: zonedInputToDate("2030-06-10T08:00"), showStart: null, prepStart: null }, "2030-01-01")).toBe("2030-06-10");
    expect(defaultAnchor({ loadIn: null, showStart: zonedInputToDate("2030-06-12T20:00"), prepStart: null }, "2030-01-01")).toBe("2030-06-12");
    expect(defaultAnchor({ loadIn: null, showStart: null, prepStart: null }, "2030-01-01")).toBe("2030-01-01");
  });
});

describe("tasks", () => {
  const tasks = [
    { id: "a", phase: "show", done: false, dueDate: "2030-06-11", sortOrder: 1 },
    { id: "b", phase: "pre_production", done: true, dueDate: "2030-06-01", sortOrder: 2 },
    { id: "c", phase: "pre_production", done: false, dueDate: null, sortOrder: 3 },
    { id: "d", phase: "pre_production", done: false, dueDate: "2030-06-03", sortOrder: 4 },
  ];
  it("sorts by phase, open first, then due date", () => {
    expect(sortTasks(tasks).map((t) => t.id)).toEqual(["d", "c", "b", "a"]);
  });
  it("reports progress per phase", () => {
    const p = taskProgress(tasks);
    expect(p.total).toBe(4);
    expect(p.done).toBe(1);
    expect(p.byPhase.find((x) => x.phase === "pre_production")).toEqual({ phase: "pre_production", total: 3, done: 1 });
  });
});

describe("3D measure", () => {
  it("defaults the file unit by format", () => {
    expect(defaultModelUnit("glb")).toBe("m");
    expect(defaultModelUnit("gltf")).toBe("m");
    expect(defaultModelUnit("stl")).toBe("mm");
    expect(defaultModelUnit("obj")).toBe("mm");
  });
  it("shows metres or centimetres depending on size", () => {
    expect(formatDistance(1250, "mm")).toBe("1.25 m");
    expect(formatDistance(453, "mm")).toBe("45.3 cm");
    expect(formatDistance(2.4, "m")).toBe("2.40 m");
    expect(formatDistance(0.08, "m")).toBe("8.0 cm");
    expect(formatDistance(120, "cm")).toBe("1.20 m");
  });
});
