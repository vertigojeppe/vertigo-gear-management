import { describe, expect, it } from "vitest";
import { ruleEstimate } from "../logic";

describe("ruleEstimate", () => {
  const facade = { baseHours: 3, minutesPerUnit: 30, ruleCrew: 3 };

  it("adds base hours and minutes per unit for the rule's crew", () => {
    expect(ruleEstimate(facade, 8, 3)).toBe(7);
    expect(ruleEstimate(facade, 8, null)).toBe(7);
  });

  it("scales by crew, keeping the person-hours", () => {
    expect(ruleEstimate(facade, 8, 6)).toBe(3.5);
    expect(ruleEstimate(facade, 8, 2)).toBe(10.5);
  });

  it("works with only a base or only a per-unit time", () => {
    expect(ruleEstimate({ baseHours: 4, minutesPerUnit: null, ruleCrew: null }, null, 2)).toBe(4);
    expect(ruleEstimate({ baseHours: null, minutesPerUnit: 15, ruleCrew: 1 }, 12, 2)).toBe(1.5);
  });

  it("gives nothing without numbers, or per unit without a unit count", () => {
    expect(ruleEstimate({ baseHours: null, minutesPerUnit: null, ruleCrew: 3 }, 8, 3)).toBeNull();
    expect(ruleEstimate(facade, null, 3)).toBeNull();
  });
});
