import { describe, expect, it } from "vitest";
import { bestMatches, buildGlossary, haystack, matchLevel, parseGlossaryText, queryTerms, searchWords, squash, substringDistance } from "../search";

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
    expect(haystack(["Robe", "Pointe", null])).toBe("robe|pointe|robepointe|^robe^pointe");
    expect(haystack(["Pointe"])).toBe("pointe|^pointe");
    expect(haystack(["Work light 50W"])).toBe("worklight50w|^work^light^50w");
    expect(matchLevel(haystack(["Robe", "Pointe"]), ["robepointe"])).toBe(0);
    expect(matchLevel(haystack(["Robe", "Pointe"]), ["robepionte"])).toBe(1);
  });
});

describe("glossary", () => {
  const glossary = buildGlossary([
    ["arbejdslys", "worklight", "work light"],
    ["kabel", "cable"],
    ["lampe", "lamp", "pære"],
    ["pære", "bulb"],
    ["flyverdragt", "flight suit"],
    ["lys", "light"],
    ["lysbord", "lighting desk"],
  ]);
  const rows = [
    { manufacturer: "", name: "Worklight LED", variant: "50 W" },
    { manufacturer: "", name: "Strømkabel", variant: "5 m" },
    { manufacturer: "Osram", name: "HMI lamp", variant: "575 W" },
    { manufacturer: "", name: "Arbejdslampe", variant: null },
    { manufacturer: "", name: "Flight suit", variant: "XL" },
  ];
  const fields = (r: (typeof rows)[number]) => [r.manufacturer, r.name, r.variant];
  const names = (q: string) => bestMatches(rows, fields, q, glossary).rows.map((r) => r.name);

  it("lets a word find its partners, in either language", () => {
    expect(names("arbejdslys")).toEqual(["Worklight LED"]);
    expect(names("work light 50w")).toEqual(["Worklight LED"]);
    expect(names("cable 5 m")).toEqual(["Strømkabel"]);
    expect(names("lamp")).toEqual(["HMI lamp", "Arbejdslampe"]);
    expect(names("pære")).toEqual(["HMI lamp", "Arbejdslampe"]); // pære is in both groups
    expect(bestMatches([{ manufacturer: "", name: "Half clamp", variant: null }, ...rows], fields, "lampe", glossary).rows.map((r) => r.name)).toEqual(["HMI lamp", "Arbejdslampe"]); // short partners start a word: no "c-lamp"
    expect(bestMatches([{ manufacturer: "", name: "Half clamp", variant: null }], fields, "lamp", glossary).rows).toHaveLength(1); // typed words still match anywhere
    expect(names("bulb")).toEqual([]); // groups do not chain: bulb → pære, not on to lamp
    expect(names("worklight")).toEqual(["Worklight LED"]);
  });

  it("still finds typos, and changes nothing without a glossary", () => {
    expect(bestMatches(rows, fields, "worklihgt", glossary)).toEqual({ rows: [rows[0]], close: true });
    expect(bestMatches(rows, fields, "arbejdslys").rows.map((r) => r.name)).not.toContain("Worklight LED");
  });

  it("lets the word still being typed find what the whole word would", () => {
    expect(names("flyver")).toEqual(["Flight suit"]);
    expect(names("flyverd")).toEqual(["Flight suit"]);
    expect(names("flight su")).toEqual(["Flight suit"]);
    expect(names("arbejd")).toEqual(["Worklight LED", "Arbejdslampe"]);
    expect(queryTerms("kab", glossary)).toEqual([["kab", "kabel", "cable"]]);
    expect(queryTerms("fl", glossary)).toEqual([["fl"]]); // under three letters: as typed only
    expect(queryTerms("lys", glossary)).toEqual([["lys", "light"]]); // a whole term: its own partners, not lysbord's
    expect(queryTerms("lys led", glossary)).toEqual([["lys", "light"], ["led"]]);
    expect(queryTerms("led flyv", glossary)).toEqual([["led"], ["flyv", "flyverdragt", "flightsuit"]]);
  });

  it("joins neighbouring words into one glossary term", () => {
    expect(queryTerms("work light led", glossary)).toEqual([["worklight", "arbejdslys"], ["led"]]);
    expect(queryTerms("work light led")).toEqual([["work"], ["light"], ["led"]]);
    expect(matchLevel("worklightled", [["arbejdslys", "worklight"], "led"])).toBe(0);
  });

  it("reads the settings text: one group per line, commas between words", () => {
    expect(parseGlossaryText("arbejdslys, worklight, work  light\n\n# comment\nkabel; cable\nstativ\nlys, LYS")).toEqual({
      groups: [["arbejdslys", "worklight"], ["kabel", "cable"]], // "work light" is "worklight" to the search
      badLines: [5, 6],
    });
  });
});
