import { describe, expect, it } from "vitest";
import { barSpan, packLanes, phaseItems, phasesOf, sortAgenda, type AgendaItem, type JobDates } from "../logic";

const none: JobDates = { prepStart: null, prepEnd: null, buildStart: null, buildEnd: null, buildCall: null, showStart: null, showEnd: null, packStart: null, packEnd: null, packCall: null, returnDate: null };
const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe("phasesOf", () => {
  it("gives day ranges with call times, and the show's times in Copenhagen time", () => {
    const phases = phasesOf({
      ...none,
      buildStart: day("2030-06-01"),
      buildEnd: day("2030-06-02"),
      buildCall: "08:00",
      showStart: new Date("2030-06-02T18:00:00Z"),
      showEnd: new Date("2030-06-02T21:30:00Z"),
      returnDate: day("2030-06-04"),
    });
    expect(phases).toEqual([
      { phase: "load_in", from: "2030-06-01", to: "2030-06-02", time: "08:00", endTime: null },
      { phase: "show", from: "2030-06-02", to: "2030-06-02", time: "20:00", endTime: "23:30" },
      { phase: "return", from: "2030-06-04", to: "2030-06-04", time: null, endTime: null },
    ]);
  });
});

describe("phaseItems", () => {
  const job = { name: "Orange", venueName: "Roskilde", phases: phasesOf({ ...none, buildStart: day("2030-06-01"), buildEnd: day("2030-06-02"), buildCall: "07:30", showStart: new Date("2030-06-02T21:00:00Z"), showEnd: new Date("2030-06-02T23:30:00Z") }) };

  it("puts a call time on every build-up day", () => {
    expect(phaseItems(job, "2030-06-01").map((i) => [i.phase, i.time])).toEqual([["load_in", "07:30"]]);
  });

  it("starts a show on its first day and ends it on the next when it runs past midnight", () => {
    expect(phaseItems(job, "2030-06-02").map((i) => [i.phase, i.time, i.endTime])).toEqual([
      ["load_in", "07:30", null],
      ["show", "23:00", null],
    ]);
    expect(phaseItems(job, "2030-06-03").map((i) => [i.phase, i.time, i.endTime])).toEqual([["show", null, "01:30"]]);
  });
});

describe("sortAgenda", () => {
  it("lists all-day items first, then by time, keeping ties in order", () => {
    const item = (title: string, time: string | null): AgendaItem => ({ day: "2030-06-01", time, endTime: null, kind: "schedule", title, context: null, where: null });
    expect(sortAgenda([item("b", "09:00"), item("rental", null), item("a", "08:00"), item("c", "09:00")]).map((i) => i.title)).toEqual(["rental", "a", "b", "c"]);
  });
});

describe("packLanes", () => {
  it("lets bars that do not overlap share a row", () => {
    const bars = [
      { id: "a", from: "2030-01-01", to: "2030-01-05" },
      { id: "b", from: "2030-01-03", to: "2030-01-10" },
      { id: "c", from: "2030-01-06", to: "2030-01-08" },
      { id: "d", from: "2030-01-11", to: "2030-01-12" },
    ];
    expect(packLanes(bars).map((lane) => lane.map((b) => b.id))).toEqual([
      ["a", "c", "d"],
      ["b"],
    ]);
  });

  it("does not share a row on the same day (the end day is inclusive)", () => {
    expect(packLanes([{ from: "2030-01-01", to: "2030-01-05" }, { from: "2030-01-05", to: "2030-01-06" }])).toHaveLength(2);
  });
});

describe("barSpan", () => {
  it("places a bar in percent of the window and clips it to the window", () => {
    expect(barSpan({ from: "2030-01-11", to: "2030-01-20" }, "2030-01-01", 100)).toEqual({ left: 10, width: 10 });
    expect(barSpan({ from: "2029-12-20", to: "2030-01-05" }, "2030-01-01", 100)).toEqual({ left: 0, width: 5 });
    expect(barSpan({ from: "2030-04-01", to: "2030-06-01" }, "2030-01-01", 100)).toEqual({ left: 90, width: 10 });
  });
});
