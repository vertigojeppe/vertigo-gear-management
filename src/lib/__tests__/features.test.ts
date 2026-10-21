import { afterEach, describe, expect, it, vi } from "vitest";
import { projectGearEnabled, switchOn } from "../features";

describe("feature switches", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads a switch as on only for on / 1 / true / yes", () => {
    expect(switchOn(undefined)).toBe(false);
    expect(switchOn("")).toBe(false);
    expect(switchOn("off")).toBe(false);
    for (const on of ["on", "ON", "1", "true", " yes "]) expect(switchOn(on)).toBe(true);
  });

  it("hides gear on projects unless PROJECT_GEAR is switched on", () => {
    vi.stubEnv("PROJECT_GEAR", "");
    expect(projectGearEnabled()).toBe(false);
    vi.stubEnv("PROJECT_GEAR", "on");
    expect(projectGearEnabled()).toBe(true);
  });
});
