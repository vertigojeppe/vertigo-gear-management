import { describe, expect, it } from "vitest";
import { colorHex, isColorKey, variantMetres } from "@/lib/colors";
import { categoryColorMap, lengthColorFor } from "../color-map";

describe("colour coding", () => {
  it("reads plain lengths out of a variant", () => {
    expect(variantMetres("5 m")).toBe(5);
    expect(variantMetres("2,5 m")).toBe(2.5);
    expect(variantMetres("7.5m")).toBe(7.5);
    expect(variantMetres("150 cm")).toBe(1.5);
    expect(variantMetres("500 mm")).toBe(0.5);
    expect(variantMetres("10 m (tynd)")).toBe(10);
    expect(variantMetres("6 udgange (450w)")).toBeNull();
    expect(variantMetres("(M-M)")).toBeNull();
    expect(variantMetres(null)).toBeNull();
  });

  it("inherits the top-level colour and the length flag", () => {
    const rows = [
      { id: "cables", parentId: null, color: "orange", lengthColors: true },
      { id: "signal", parentId: "cables", color: null, lengthColors: false },
      { id: "dmx", parentId: "signal", color: "pink", lengthColors: false },
      { id: "video", parentId: null, color: "blue", lengthColors: false },
      { id: "proj", parentId: "video", color: null, lengthColors: false },
      { id: "loose", parentId: "gone", color: null, lengthColors: false },
    ];
    const map = categoryColorMap(rows);
    expect(map.get("dmx")).toEqual({ color: "orange", lengthColors: true });
    expect(map.get("signal")).toEqual({ color: "orange", lengthColors: true });
    expect(map.get("proj")).toEqual({ color: "blue", lengthColors: false });
    expect(map.get("loose")).toEqual({ color: null, lengthColors: false });
  });

  it("gives cable variants their tape colour only where the category says so", () => {
    const lengths = new Map<number, string>([
      [2.5, "blue"],
      [5, "red"],
      [10, "white"],
    ]);
    expect(lengthColorFor("5 m", { color: "orange", lengthColors: true }, lengths)).toBe("red");
    expect(lengthColorFor("2,5 m", { color: null, lengthColors: true }, lengths)).toBe("blue");
    expect(lengthColorFor("15 m", { color: null, lengthColors: true }, lengths)).toBeNull();
    expect(lengthColorFor("5 m", { color: "blue", lengthColors: false }, lengths)).toBeNull();
    expect(lengthColorFor("5 m", undefined, lengths)).toBeNull();
  });

  it("knows its palette", () => {
    expect(isColorKey("red")).toBe(true);
    expect(isColorKey("beige")).toBe(false);
    expect(colorHex("white")).toMatch(/^#/);
    expect(colorHex(null)).toBeNull();
  });
});
