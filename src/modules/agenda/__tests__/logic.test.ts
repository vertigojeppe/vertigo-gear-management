import { describe, expect, it } from "vitest";
import { dateToZonedInput } from "@/lib/dates";
import { entryFormValues, entryTimes, entryTitle, googleTemplateLink, parseGuests } from "../logic";

describe("entryTimes", () => {
  it("keeps time off to whole days, first to last", () => {
    expect(entryTimes({ kind: "time_off", allDay: false, fromDate: "2030-07-01", toDate: "2030-07-05", startTime: "09:00" })).toEqual({ allDay: true, startsAt: new Date("2030-07-01T00:00:00Z"), endsAt: new Date("2030-07-05T00:00:00Z") });
  });

  it("refuses a last day before the first", () => {
    expect(() => entryTimes({ kind: "time_off", allDay: true, fromDate: "2030-07-05", toDate: "2030-07-01" })).toThrow("The last day is before the first.");
  });

  it("reads a meeting's times in Copenhagen time, an hour long without an end, and past midnight when the end is earlier", () => {
    expect(entryTimes({ kind: "meeting", allDay: false, fromDate: "2030-07-01", startTime: "10:00", endTime: "11:30" })).toEqual({ allDay: false, startsAt: new Date("2030-07-01T08:00:00Z"), endsAt: new Date("2030-07-01T09:30:00Z") });
    expect(entryTimes({ kind: "meeting", allDay: false, fromDate: "2030-07-01", startTime: "10:00" }).endsAt).toEqual(new Date("2030-07-01T09:00:00Z"));
    expect(entryTimes({ kind: "assignment", allDay: false, fromDate: "2030-07-01", startTime: "22:00", endTime: "02:00" }).endsAt).toEqual(new Date("2030-07-02T00:00:00Z"));
  });

  it("makes an entry without a start time a whole day", () => {
    expect(entryTimes({ kind: "assignment", allDay: false, fromDate: "2030-07-01" }).allDay).toBe(true);
  });
});

describe("entryTitle and parseGuests", () => {
  it("lets time off go without a title, nothing else", () => {
    expect(entryTitle("time_off", "  ")).toBe("Off");
    expect(entryTitle("meeting", " Rig check ")).toBe("Rig check");
    expect(() => entryTitle("meeting", "")).toThrow("Give it a title.");
  });

  it("reads guests separated by commas, spaces or lines, once each, and names the bad ones", () => {
    expect(parseGuests("Anna@example.com, bo@example.com\nanna@example.com")).toEqual(["anna@example.com", "bo@example.com"]);
    expect(() => parseGuests("anna@example.com, not-an-address")).toThrow("Not an email address: not-an-address.");
  });
});

describe("googleTemplateLink", () => {
  it("fills whole days with an exclusive end and timed entries in UTC", () => {
    const allDay = new URL(googleTemplateLink({ title: "Off", allDay: true, startsAt: new Date("2030-07-01T00:00:00Z"), endsAt: new Date("2030-07-05T00:00:00Z"), location: null, details: "" }));
    expect(allDay.searchParams.get("dates")).toBe("20300701/20300706");
    const timed = new URL(googleTemplateLink({ title: "Rig check", allDay: false, startsAt: new Date("2030-07-01T08:00:00Z"), endsAt: new Date("2030-07-01T09:30:00Z"), location: "Vega", details: "x" }));
    expect(timed.searchParams.get("dates")).toBe("20300701T080000Z/20300701T093000Z");
    expect(timed.searchParams.get("location")).toBe("Vega");
  });
});

describe("entryFormValues", () => {
  it("gives the edit form Copenhagen dates and times back", () => {
    const v = entryFormValues({ id: "e1", kind: "meeting", title: "Rig check", projectId: null, allDay: false, startsAt: new Date("2030-07-01T08:00:00Z"), endsAt: new Date("2030-07-01T09:30:00Z"), location: null, notes: null, guests: ["a@example.com"], people: [{ id: "u1" }] }, dateToZonedInput);
    expect(v).toMatchObject({ fromDate: "2030-07-01", startTime: "10:00", endTime: "11:30", guestsText: "a@example.com", people: ["u1"] });
  });
});
