import { describe, expect, it } from "vitest";
import { formatQty, isLow, roundQty, sparesFor, suggestSpares } from "../consumables-logic";

describe("consumables logic", () => {
  it("formats and rounds by unit", () => {
    expect(formatQty(12.5, "m")).toBe("12,5 m");
    expect(formatQty(0.1 + 0.2, "m")).toBe("0,3 m");
    expect(formatQty(3, "pcs", "stk.")).toBe("3 stk.");
    expect(roundQty(2.4, "pcs")).toBe(2);
    expect(roundQty(2.456, "m")).toBe(2.46);
  });

  it("flags running low only below a set threshold", () => {
    expect(isLow(2, 3)).toBe(true);
    expect(isLow(3, 3)).toBe(false);
    expect(isLow(0, null)).toBe(false);
    expect(isLow(1.5, 2)).toBe(true);
  });

  it("asks for one spare per N units, at least the minimum", () => {
    expect(sparesFor(6, { perUnits: 4, minQty: 1 })).toBe(2);
    expect(sparesFor(1, { perUnits: 4, minQty: 1 })).toBe(1);
    expect(sparesFor(1, { perUnits: 4, minQty: 2 })).toBe(2);
    expect(sparesFor(8, { perUnits: 4, minQty: 1 })).toBe(2);
    expect(sparesFor(0, { perUnits: 4, minQty: 1 })).toBe(0);
    expect(sparesFor(3, { perUnits: 0, minQty: 0 })).toBe(3);
  });

  it("counts what is already on the list against what is in house", () => {
    const s = suggestSpares({ units: new Map([["rz120", 6]]), fits: [{ partId: "lamp", modelId: "rz120", perUnits: 4, minQty: 1 }], onList: new Map([["lamp", 1]]), inHouse: new Map([["lamp", 1]]) });
    expect(s).toEqual([{ partId: "lamp", wanted: 2, onList: 1, add: 0, short: 1, forModels: ["rz120"] }]);
  });

  it("suggests spares for the list, capped by what is in house", () => {
    const s = suggestSpares({
      units: new Map([
        ["rz120", 6],
        ["rz21k", 2],
        ["mover", 4],
      ]),
      fits: [
        { partId: "lamp", modelId: "rz120", perUnits: 4, minQty: 1 },
        { partId: "lamp", modelId: "rz21k", perUnits: 4, minQty: 1 },
        { partId: "filter", modelId: "rz120", perUnits: 2, minQty: 1 },
        { partId: "fuse", modelId: "mover", perUnits: 4, minQty: 1 },
        { partId: "gobo", modelId: "notOnList", perUnits: 1, minQty: 1 },
      ],
      onList: new Map([["fuse", 1]]),
      inHouse: new Map([
        ["lamp", 5],
        ["filter", 1],
      ]),
    });
    expect(s).toEqual([
      { partId: "lamp", wanted: 3, onList: 0, add: 3, short: 0, forModels: ["rz120", "rz21k"] },
      { partId: "filter", wanted: 3, onList: 0, add: 1, short: 2, forModels: ["rz120"] },
    ]);
  });
});
