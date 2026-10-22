import { describe, expect, it } from "vitest";
import { itemOrderBy, sortFamilies, type SortableFamily } from "../sorting";

const fam = (name: string, over: Partial<SortableFamily> = {}): SortableFamily => ({
  name,
  manufacturer: "",
  categoryPath: ["Lighting"],
  owned: 0,
  inHouse: 0,
  addedAt: new Date("2026-01-01"),
  dayPrice: null,
  weightKg: null,
  packed: 0,
  ...over,
});

const families = [
  fam("Pointe", { manufacturer: "Robe", categoryPath: ["Lighting", "Moving heads"], owned: 8, inHouse: 2, addedAt: new Date("2026-05-01"), dayPrice: 450, weightKg: 15, packed: 30 }),
  fam("Ærgerlig kasse", { categoryPath: ["Cases"], owned: 1, inHouse: 1 }),
  fam("DMX 5-pin", { categoryPath: ["Cables", "DMX"], owned: 60, inHouse: 55, dayPrice: 10, weightKg: 0.4, packed: 120 }),
  fam("Atom 20", { manufacturer: "Kvant", categoryPath: ["Laser", "Laser projectors"], owned: 2, inHouse: 2, addedAt: new Date("2026-09-01"), dayPrice: 1200, weightKg: 12 }),
];
const names = (sort: Parameters<typeof sortFamilies>[1]) => sortFamilies(families, sort).map((f) => f.name);

describe("inventory sorting", () => {
  it("sorts by name the Danish way (Æ after Z), by default", () => {
    expect(names(undefined)).toEqual(["Atom 20", "DMX 5-pin", "Pointe", "Ærgerlig kasse"]);
    expect(names("name")).toEqual(names(undefined));
  });

  it("sorts by category path, then name", () => {
    expect(names("category")).toEqual(["DMX 5-pin", "Ærgerlig kasse", "Atom 20", "Pointe"]);
  });

  it("sorts by manufacturer with own-built gear last", () => {
    expect(names("manufacturer")).toEqual(["Atom 20", "Pointe", "DMX 5-pin", "Ærgerlig kasse"]);
  });

  it("puts the largest first for counts, dates, prices and weights; missing values last", () => {
    expect(names("units")).toEqual(["DMX 5-pin", "Pointe", "Atom 20", "Ærgerlig kasse"]);
    expect(names("out")).toEqual(["Pointe", "DMX 5-pin", "Atom 20", "Ærgerlig kasse"]); // 6, 5, 0, 0
    expect(names("packed")).toEqual(["DMX 5-pin", "Pointe", "Atom 20", "Ærgerlig kasse"]);
    expect(names("newest")).toEqual(["Atom 20", "Pointe", "DMX 5-pin", "Ærgerlig kasse"]);
    expect(names("price")).toEqual(["Atom 20", "Pointe", "DMX 5-pin", "Ærgerlig kasse"]);
    expect(names("weight")).toEqual(["Pointe", "Atom 20", "DMX 5-pin", "Ærgerlig kasse"]);
  });

  it("does not reorder the list it was given", () => {
    const before = families.map((f) => f.name);
    sortFamilies(families, "units");
    expect(families.map((f) => f.name)).toEqual(before);
  });

  it("orders items by tag unless told otherwise, always ending on the tag", () => {
    expect(itemOrderBy()).toEqual([{ assetTag: "asc" }]);
    expect(itemOrderBy("changed")).toEqual([{ updatedAt: "desc" }, { assetTag: "asc" }]);
    expect(itemOrderBy("purchased")[0]).toEqual({ purchaseDate: { sort: "desc", nulls: "last" } });
    for (const s of ["model", "location", "changed", "purchased"] as const) expect(itemOrderBy(s).at(-1)).toEqual({ assetTag: "asc" });
  });
});
