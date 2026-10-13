import { describe, expect, it } from "vitest";
import { filterCatalog, type CatalogEntry } from "../picker";

const e = (kind: CatalogEntry["kind"], label: string, category: string, tags: string[] = [], extra: Partial<CatalogEntry> = {}): CatalogEntry => ({ kind, id: label, label, family: label, variant: null, category, trackingType: kind === "kit" ? "kit" : "serialized", owned: 1, inHouse: 1, onList: 0, tags, ...extra });
const catalog = [
  e("model", "Robe Pointe", "Lighting › Moving heads", ["VG-0001", "VG-0002"]),
  e("model", "Robe Esprite", "Lighting › Moving heads"),
  e("model", "Martin MAC Aura XB", "Lighting › Moving heads"),
  e("model", "Generic True1 5 m", "Cables › True1"),
  e("model", "Vertigo SplitLED 60cm", "Lighting › LED"),
  e("kit", "Pointe case 1", "Robe case", ["VG-0200"]),
  e("model", "Astera Titan Tube (set of 8)", "Lighting › LED"),
];

describe("filterCatalog", () => {
  it("returns nothing for an empty query", () => {
    expect(filterCatalog(catalog, "  ")).toEqual([]);
  });
  it("ranks label prefix, then label contains, then category or tag matches", () => {
    expect(filterCatalog(catalog, "point").map((x) => x.label)).toEqual(["Pointe case 1", "Robe Pointe"]);
    expect(filterCatalog(catalog, "robe").map((x) => x.label)).toEqual(["Robe Pointe", "Robe Esprite", "Pointe case 1"]);
    expect(filterCatalog(catalog, "moving").map((x) => x.label)).toEqual(["Robe Pointe", "Robe Esprite", "Martin MAC Aura XB"]);
  });
  it("needs every word, in any order, ignoring case and accents", () => {
    expect(filterCatalog(catalog, "aura martin").map((x) => x.label)).toEqual(["Martin MAC Aura XB"]);
    expect(filterCatalog(catalog, "TRUE1 5").map((x) => x.label)).toEqual(["Generic True1 5 m"]);
    expect(filterCatalog(catalog, "splitléd").map((x) => x.label)).toEqual(["Vertigo SplitLED 60cm"]);
    expect(filterCatalog(catalog, "robe cable")).toEqual([]);
  });
  it("puts an exact asset tag first (what a scanner types)", () => {
    expect(filterCatalog(catalog, "VG-0200")[0].label).toBe("Pointe case 1");
    expect(filterCatalog(catalog, "vg-0001").map((x) => x.label)).toEqual(["Robe Pointe"]);
  });
  it("limits the result", () => {
    expect(filterCatalog(catalog, "e", 2)).toHaveLength(2);
  });
});
