import { describe, expect, it } from "vitest";
import { jobEvents, type JobDates } from "../job-events";

const none: JobDates = { prepStart: null, prepEnd: null, buildStart: null, buildEnd: null, buildCall: null, showStart: null, showEnd: null, packStart: null, packEnd: null, packCall: null, returnDate: null };
const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe("jobEvents", () => {
  it("gives a one-day job one banner plus timed build-up, show and pack-down", () => {
    const ev = jobEvents({ ...none, buildStart: day("2030-03-12"), buildCall: "08:00", showStart: new Date("2030-03-12T18:00:00Z"), packStart: day("2030-03-12"), packCall: "23:00" });
    expect(ev.map((e) => e.key)).toEqual(["job", "load_in:2030-03-12", "show", "load_out:2030-03-12"]);
    expect(ev.filter((e) => e.allDay)).toHaveLength(1);
  });

  it("leaves a build-up without a call time in the banner only", () => {
    const ev = jobEvents({ ...none, buildStart: day("2030-03-12"), buildEnd: day("2030-03-13"), returnDate: day("2030-03-14") });
    expect(ev.map((e) => e.key)).toEqual(["job"]);
    const job = ev[0];
    expect(job.allDay && [job.firstDay, job.lastDay]).toEqual(["2030-03-12", "2030-03-14"]);
    expect(job.allDay && job.lines).toEqual(["Build-up: 12.03.2030 – 13.03.2030", "Return: 14.03.2030"]);
  });

  it("keeps the call time across the switch to summer time", () => {
    // Clocks go forward on 31 March 2030: 08:00 is 07:00 UTC before and 06:00 UTC after.
    const ev = jobEvents({ ...none, buildStart: day("2030-03-30"), buildEnd: day("2030-03-31"), buildCall: "08:00" }).filter((e) => !e.allDay);
    expect(ev.map((e) => !e.allDay && e.start.toISOString())).toEqual(["2030-03-30T07:00:00.000Z", "2030-03-31T06:00:00.000Z"]);
  });

  it("stretches the banner to the day a late show ends", () => {
    const ev = jobEvents({ ...none, showStart: new Date("2030-03-12T21:00:00Z"), showEnd: new Date("2030-03-12T23:30:00Z") });
    const job = ev[0];
    expect(job.allDay && [job.firstDay, job.lastDay]).toEqual(["2030-03-12", "2030-03-13"]); // 00:30 Copenhagen time
    expect(job.allDay && job.lines).toEqual(["Show: 12.03.2030 22:00 – 13.03.2030 00:30"]);
  });

  it("makes no events for a job without dates", () => {
    expect(jobEvents(none)).toEqual([]);
  });
});
