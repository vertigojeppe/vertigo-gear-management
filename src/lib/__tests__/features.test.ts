import { describe, expect, it } from "vitest";
import { projectGearEnabled } from "../features";

describe("feature switches", () => {
  it("hides gear on projects unless PROJECT_GEAR is switched on", () => {
    expect(projectGearEnabled(undefined)).toBe(false);
    expect(projectGearEnabled("")).toBe(false);
    expect(projectGearEnabled("off")).toBe(false);
    for (const on of ["on", "ON", "1", "true", " yes "]) expect(projectGearEnabled(on)).toBe(true);
  });
});
