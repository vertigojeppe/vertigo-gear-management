import { describe, expect, it } from "vitest";
import { dateFloors } from "../date-floors";

describe("dateFloors", () => {
  it("has no floors on an empty form", () => {
    expect(Object.values(dateFloors({})).every((f) => f === undefined)).toBe(true);
  });

  it("starts every later field from the prep start", () => {
    const f = dateFloors({ prepStart: "2026-11-02" });
    expect(f).toEqual({ prepStart: undefined, prepEnd: "2026-11-02", buildStart: "2026-11-02", buildEnd: "2026-11-02", showStart: "2026-11-02T00:00", showEnd: "2026-11-02T00:00", packStart: "2026-11-02", packEnd: "2026-11-02", returnDate: "2026-11-02" });
  });

  it("moves the floor to each phase's start, so phases may overlap but not run backwards", () => {
    const f = dateFloors({ prepStart: "2026-11-02", prepEnd: "2026-11-06", buildStart: "2026-11-05", showStart: "2026-11-07T19:30", packStart: "2026-11-08" });
    // Build-up may start while prep is still running (only the prep start counts).
    expect(f.buildStart).toBe("2026-11-02");
    expect(f.buildEnd).toBe("2026-11-05");
    expect(f.showStart).toBe("2026-11-05T00:00");
    expect(f.showEnd).toBe("2026-11-07T19:30");
    expect(f.packStart).toBe("2026-11-07");
    expect(f.packEnd).toBe("2026-11-08");
    expect(f.returnDate).toBe("2026-11-08");
  });

  it("skips phases left empty", () => {
    const f = dateFloors({ buildStart: "2026-12-01" });
    expect(f.prepEnd).toBeUndefined();
    expect(f.buildStart).toBeUndefined();
    expect(f.returnDate).toBe("2026-12-01");
  });

  it("ignores half-typed values", () => {
    expect(dateFloors({ prepStart: "2026-1" }).returnDate).toBeUndefined();
  });
});
