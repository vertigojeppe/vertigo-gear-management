import { describe, expect, it } from "vitest";
import { cellFor, labelSize, mm, pageCount, pageMm, perPage } from "../label-layout";

describe("label layout", () => {
  const avery = labelSize("avery_l7160");
  const thermal = labelSize("thermal_62x29");

  it("centres the Avery L7160 grid like the sheet's own margins", () => {
    expect(perPage(avery)).toBe(21);
    const first = cellFor(avery, 0);
    // 3 × 63.5 + 2 × 2.5 = 195.5 wide → 7.25 mm left; 7 × 38.1 = 266.7 tall → 15.15 mm top.
    expect(first).toEqual({ page: 0, index: 0, xMm: 7.25, yMm: 15.15 });
    expect(cellFor(avery, 1).xMm).toBe(73.25); // one label plus the 2.5 mm gap to the right
    expect(cellFor(avery, 3)).toMatchObject({ index: 3, xMm: 7.25, yMm: 53.25 }); // second row
    expect(cellFor(avery, 21)).toMatchObject({ page: 1, index: 0 });
  });

  it("skips used cells on the first sheet with an offset", () => {
    expect(cellFor(avery, 0, 5)).toMatchObject({ page: 0, index: 5 });
    expect(cellFor(avery, 16, 5)).toMatchObject({ page: 1, index: 0 });
    expect(pageCount(avery, 21)).toBe(1);
    expect(pageCount(avery, 22)).toBe(2);
    expect(pageCount(avery, 21, 1)).toBe(2);
    expect(pageCount(avery, 0)).toBe(0);
  });

  it("gives thermal labels one page each, the size of the label", () => {
    expect(pageMm(thermal)).toEqual({ w: 62, h: 29 });
    expect(cellFor(thermal, 0)).toEqual({ page: 0, index: 0, xMm: 0, yMm: 0 });
    expect(cellFor(thermal, 7)).toMatchObject({ page: 7, index: 0 });
    expect(pageCount(thermal, 7)).toBe(7);
  });

  it("converts millimetres to points", () => {
    expect(mm(25.4)).toBe(72);
    expect(mm(210)).toBeCloseTo(595.276, 2);
  });
});
