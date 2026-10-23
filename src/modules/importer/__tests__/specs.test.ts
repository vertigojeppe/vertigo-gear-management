import { describe, expect, it } from "vitest";
import { decodeSheet, parseDelimited, parseSpecNumber, pickKey, planSpecs, readSpecSheet, specUpdate, type CurrentModel } from "../specs";

const model = (over: Partial<CurrentModel> = {}): CurrentModel => ({
  id: "m1",
  label: "Stand 387XBU (Manfrotto)",
  numbers: { weightKg: null, widthCm: null, heightCm: null, depthCm: null, powerDrawW: null },
  description: null,
  links: [],
  customFields: {},
  customKeys: [],
  ...over,
});

describe("parseDelimited", () => {
  it("reads semicolons, quotes and line breaks inside quoted cells", () => {
    const rows = parseDelimited('﻿Id;Description\r\nm1;"Min height: 156 cm\r\nPayload: 80 kg"\r\nm2;"1 1/8"" socket"\r\n');
    expect(rows).toEqual([
      ["﻿Id", "Description"],
      ["m1", "Min height: 156 cm\nPayload: 80 kg"],
      ["m2", '1 1/8" socket'],
    ]);
  });

  it("uses commas when the header has more commas than semicolons", () => {
    expect(parseDelimited("Id,Weight (kg)\nm1,2.5\n")).toEqual([
      ["Id", "Weight (kg)"],
      ["m1", "2.5"],
    ]);
  });
});

describe("parseSpecNumber", () => {
  it("takes Danish and English decimals", () => {
    expect(parseSpecNumber("32,5", false)).toBe(32.5);
    expect(parseSpecNumber("32.5", false)).toBe(32.5);
    expect(parseSpecNumber("", false)).toBeNull();
  });

  it("strips thousands separators from whole numbers only", () => {
    expect(parseSpecNumber("3.500", true)).toBe(3500);
    expect(parseSpecNumber("3 500", true)).toBe(3500);
    expect(parseSpecNumber("1.5", true)).toBeNaN();
    expect(parseSpecNumber("ca. 5", false)).toBeNaN();
  });
});

describe("decodeSheet", () => {
  it("falls back to Windows-1252 for Excel's plain CSV", () => {
    expect(decodeSheet(new Uint8Array([0x66, 0xe6, 0x72, 0x64, 0x69, 0x67]))).toBe("færdig");
    expect(decodeSheet(new TextEncoder().encode("﻿færdig"))).toBe("færdig");
  });
});

describe("readSpecSheet", () => {
  it("needs an Id column", () => {
    expect(readSpecSheet("Name;Weight (kg)\nx;1\n").errors[0]).toMatch(/Id/);
  });

  it("reads numbers, extra fields, description and links, and reports bad numbers by line", () => {
    const sheet = readSpecSheet(
      'Id;Weight (kg);Power (W);Lumen;Throw ratio;Description;Links;Sources\nm1;3,6;"3.400";3.500;1.15–1.5;"Resolution: WXGA";"Product page | https://example.com/p";https://src\nm2;heavy;;;;;;\n',
    );
    expect(sheet.rows[0]).toMatchObject({
      id: "m1",
      numbers: { weightKg: 3.6, powerDrawW: 3400 },
      custom: { lumen: 3500, throw_ratio: "1.15–1.5" },
      description: "Resolution: WXGA",
      links: [{ label: "Product page", url: "https://example.com/p" }],
    });
    expect(sheet.errors).toEqual(['Row 3: "heavy" in Weight (kg) is not a number.']);
  });
});

describe("planSpecs", () => {
  const sheet = readSpecSheet(
    "Id;Weight (kg);Height (cm);Power (W);Lumen;Description;Links\nm1;32,5;180;;3500;Payload: 80 kg;https://example.com/a\nm2;1;;;;;\nmissing;1;;;;;\n",
  );

  it("fills empty fields, keeps different values, and lists unknown ids", () => {
    const current = new Map([
      ["m1", model({ numbers: { weightKg: 32.5, widthCm: null, heightCm: 175, depthCm: null, powerDrawW: null }, description: "Ours", links: [{ label: "A", url: "https://example.com/a" }], customKeys: ["lumen"] })],
      ["m2", model({ id: "m2", label: "Clamp" })],
    ]);
    const plan = planSpecs(sheet, current);
    expect(plan.unknownIds).toEqual([{ line: 4, id: "missing" }]);
    expect(plan.models[0].changes.map((c) => [c.field, c.action])).toEqual([
      ["weightKg", "same"],
      ["heightCm", "keep"],
      ["lumen", "fill"],
      ["description", "keep"],
      ["links", "same"],
    ]);
    expect(plan.models[1].changes).toEqual([{ field: "weightKg", from: null, to: "1", action: "fill" }]);
  });

  it("does not write an extra field the model's category does not have", () => {
    const plan = planSpecs(sheet, new Map([["m1", model()]]));
    expect(plan.models[0].changes.find((c) => c.field === "lumen")?.action).toBe("unavailable");
  });

  it("without ticks, writes only the fills, appending new links and merging extra fields", () => {
    const m = model({ links: [{ label: "Old", url: "https://old" }], customFields: { throw_ratio: "1.2" }, customKeys: ["lumen", "throw_ratio"] });
    const plan = planSpecs(sheet, new Map([["m1", m]]));
    const { data, changes } = specUpdate(sheet.rows[0], m, plan.models[0]);
    expect(changes.map((c) => c.field)).toEqual(["weightKg", "heightCm", "lumen", "description", "links"]);
    expect(data).toEqual({
      weightKg: 32.5,
      heightCm: 180,
      description: "Payload: 80 kg",
      links: [
        { label: "Old", url: "https://old" },
        { label: "example.com/a", url: "https://example.com/a" },
      ],
      customFields: { throw_ratio: "1.2", lumen: 3500 },
    });
  });

  it("writes what is ticked: an unticked fill is skipped, a ticked kept value is replaced", () => {
    const m = model({ numbers: { weightKg: 30, widthCm: null, heightCm: null, depthCm: null, powerDrawW: null }, customKeys: ["lumen"] });
    const plan = planSpecs(sheet, new Map([["m1", m]]));
    const picked = new Set([pickKey("m1", "weightKg"), pickKey("m1", "lumen"), pickKey("m1", "notAField")]);
    const { data, changes } = specUpdate(sheet.rows[0], m, plan.models[0], picked);
    expect(changes.map((c) => [c.field, c.action])).toEqual([
      ["weightKg", "keep"],
      ["lumen", "fill"],
    ]);
    expect(data).toEqual({ weightKg: 32.5, customFields: { lumen: 3500 } });
  });
});
