import { describe, expect, it } from "vitest";
import { zonedInputToDate } from "@/lib/dates";
import { dayRange, deriveWindow, ProjectError } from "../service";

describe("day ranges", () => {
  it("treats one end alone as a single day", () => {
    expect(dayRange("2030-06-10", undefined, "buildEnd")).toEqual(["2030-06-10", "2030-06-10"]);
    expect(dayRange(undefined, "2030-06-12", "buildEnd")).toEqual(["2030-06-12", "2030-06-12"]);
    expect(dayRange(undefined, undefined, "buildEnd")).toEqual([null, null]);
    expect(dayRange("2030-06-10", "2030-06-12", "buildEnd")).toEqual(["2030-06-10", "2030-06-12"]);
  });

  it("refuses a range that runs backwards, on the end field", () => {
    expect(() => dayRange("2030-06-12", "2030-06-10", "packEnd")).toThrow(ProjectError);
    try {
      dayRange("2030-06-12", "2030-06-10", "packEnd");
    } catch (e) {
      expect((e as ProjectError).field).toBe("packEnd");
    }
  });

  it("reserves from the first to the last day of every phase", () => {
    expect(
      deriveWindow({
        prepStart: "2030-06-08",
        prepEnd: "2030-06-09",
        buildStart: "2030-06-10",
        buildEnd: "2030-06-11",
        showStart: zonedInputToDate("2030-06-12T20:00"),
        showEnd: zonedInputToDate("2030-06-13T01:00"),
        packStart: "2030-06-13",
        packEnd: "2030-06-15",
      }),
    ).toEqual({ from: "2030-06-08", to: "2030-06-15" });
    expect(deriveWindow({ buildStart: "2030-06-10", buildEnd: "2030-06-12" })).toEqual({ from: "2030-06-10", to: "2030-06-12" });
    expect(deriveWindow({})).toEqual({ from: null, to: null });
  });
});
