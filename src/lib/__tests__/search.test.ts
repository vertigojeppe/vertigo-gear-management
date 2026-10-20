import { describe, expect, it } from "vitest";
import { bestMatches, haystack, matchLevel, searchWords, squash, substringDistance } from "../search";

describe("squash", () => {
  it("drops spaces, punctuation, case and accents but keeps æ and ø", () => {
    expect(squash("Q Base")).toBe("qbase");
    expect(squash("VG-0012")).toBe("vg0012");
    expect(squash("DMX 5-pin, 7.5 m")).toBe("dmx5pin75m");
    expect(squash("Café Ø-lys Æble")).toBe("cafeølysæble");
    expect(squash(null)).toBe("");
  });

  it("splits the query into squashed words", () => {
    expect(searchWords("  q base ")).toEqual(["q", "base"]);
    expect(searchWords("VG-12")).toEqual(["vg12"]);
    expect(searchWords("- ")).toEqual([]);
  });
});

describe("substringDistance", () => {
  it("counts edits against the best-fitting part of the text", () => {
    expect(substringDistance("pointe", "robepointe", 1)).toBe(0);
    expect(substringDistance("pinte", "robepointe", 1)).toBe(1); // missing letter
    expect(substringDistance("poinnte", "robepointe", 1)).toBe(1); // extra letter
    expect(substringDistance("piont", "robepointe", 1)).toBe(1); // swapped letters
    expect(substringDistance("paxnte", "robepointe", 1)).toBe(2); // gives up past the limit
  });
});

describe("matching", () => {
  const rows = [
    { manufacturer: "Showtec", name: "Q Base", variant: null },
    { manufacturer: "Robe", name: "Pointe", variant: null },
    { manufacturer: "", name: "DMX 5-pin", variant: "10 m" },
  ];
  const fields = (r: (typeof rows)[number]) => [r.manufacturer, r.name, r.variant];

  it("finds a row however the spaces fall", () => {
    expect(bestMatches(rows, fields, "qbase").rows.map((r) => r.name)).toEqual(["Q Base"]);
    expect(bestMatches(rows, fields, "q base").rows.map((r) => r.name)).toEqual(["Q Base"]);
    expect(bestMatches(rows, fields, "dmx5pin 10m").rows.map((r) => r.name)).toEqual(["DMX 5-pin"]);
    expect(bestMatches(rows, fields, "pointe robe")).toEqual({ rows: [rows[1]], close: false });
  });

  it("falls back to close matches only when nothing matches exactly", () => {
    expect(bestMatches(rows, fields, "pinte")).toEqual({ rows: [rows[1]], close: true });
    expect(bestMatches(rows, fields, "qbse")).toEqual({ rows: [rows[0]], close: true });
    expect(bestMatches(rows, fields, "zzzz")).toEqual({ rows: [], close: false });
    expect(bestMatches(rows, fields, "")).toEqual({ rows, close: false });
  });

  it("allows no typos in short words and reads the fields together too", () => {
    expect(matchLevel(haystack(["Robe", "Pointe"]), ["rob"])).toBe(0);
    expect(matchLevel(haystack(["Robe", "Pointe"]), ["rox"])).toBeNull();
    expect(haystack(["Robe", "Pointe", null])).toBe("robe|pointe|robepointe");
    expect(haystack(["Pointe"])).toBe("pointe");
    expect(matchLevel(haystack(["Robe", "Pointe"]), ["robepointe"])).toBe(0);
    expect(matchLevel(haystack(["Robe", "Pointe"]), ["robepionte"])).toBe(1);
  });
});
