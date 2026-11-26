import { describe, expect, it } from "vitest";
import { groupLines } from "../queries";

const line = (section: string | null, categoryTop = "Light") => ({ categoryTop, categoryColor: null, caseItemId: null, caseLabel: null, section });

describe("groupLines by section", () => {
  it("groups by the list's own sections, numbers in order, unsectioned last", () => {
    const groups = groupLines([line(null), line("Truck 10"), line("Stage left"), line("truck 2"), line("Truck 2"), line("Stage left")], "section");
    expect(groups.map((g) => [g.label, g.lines.length])).toEqual([
      ["Stage left", 2],
      ["truck 2", 2],
      ["Truck 10", 1],
      ["No section", 1],
    ]);
  });

  it("leaves category grouping alone", () => {
    expect(groupLines([line("Stage left", "Video"), line(null, "Light")], "category").map((g) => g.label)).toEqual(["Light", "Video"]);
  });
});
