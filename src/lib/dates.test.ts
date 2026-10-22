import { describe, expect, it } from "vitest";
import { addDays, dateToZonedInput, daysBetween, isoWeek, isoWeekday, maxDate, minDate, rangesOverlap, zonedInputToDate } from "./dates";

describe("dates", () => {
  it("converts Copenhagen wall clock to UTC and back (winter and summer)", () => {
    const winter = zonedInputToDate("2026-01-15T08:00");
    expect(winter.toISOString()).toBe("2026-01-15T07:00:00.000Z");
    expect(dateToZonedInput(winter)).toBe("2026-01-15T08:00");
    const summer = zonedInputToDate("2026-07-15T08:00");
    expect(summer.toISOString()).toBe("2026-07-15T06:00:00.000Z");
    expect(dateToZonedInput(summer)).toBe("2026-07-15T08:00");
  });

  it("does day arithmetic on date strings", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(daysBetween("2026-11-10", "2026-11-12")).toBe(3);
    expect(daysBetween("2026-11-10", "2026-11-10")).toBe(1);
    expect(minDate("2026-11-10", null, "2026-11-02")).toBe("2026-11-02");
    expect(maxDate(undefined, "2026-11-10", "2026-11-02")).toBe("2026-11-10");
    expect(minDate(null, undefined)).toBeNull();
  });

  it("checks inclusive overlap", () => {
    expect(rangesOverlap("2026-11-10", "2026-11-12", "2026-11-12", "2026-11-14")).toBe(true);
    expect(rangesOverlap("2026-11-10", "2026-11-12", "2026-11-13", "2026-11-14")).toBe(false);
  });
});

describe("ISO weeks", () => {
  it("numbers weekdays Monday 1 to Sunday 7", () => {
    expect(isoWeekday("2026-10-19")).toBe(1);
    expect(isoWeekday("2026-10-25")).toBe(7);
  });

  it("numbers weeks the way Danish calendars do, across year ends", () => {
    expect(isoWeek("2026-10-22")).toBe(43);
    expect(isoWeek("2026-01-01")).toBe(1); // a Thursday
    expect(isoWeek("2026-12-31")).toBe(53); // 2026 has 53 weeks
    expect(isoWeek("2027-01-03")).toBe(53); // Sunday: still last year's week
    expect(isoWeek("2027-01-04")).toBe(1);
    expect(isoWeek("2024-12-30")).toBe(1); // Monday: already next year's week 1
    expect(isoWeek("2021-01-03")).toBe(53);
  });
});
