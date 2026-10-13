import { describe, expect, it } from "vitest";
import { cell, toCsv } from "../csv";

describe("csv", () => {
  it("quotes only what needs it and escapes quotes", () => {
    expect(cell("plain")).toBe("plain");
    expect(cell("semi;colon")).toBe('"semi;colon"');
    expect(cell('say "hi"')).toBe('"say ""hi"""');
    expect(cell("two\nlines")).toBe('"two\nlines"');
    expect(cell("a,b", ",")).toBe('"a,b"');
    expect(cell("a,b", ";")).toBe("a,b");
  });
  it("formats dates, numbers, booleans, arrays, objects and nothing", () => {
    expect(cell(new Date("2026-10-13T06:00:00Z"))).toBe("2026-10-13T06:00:00.000Z");
    expect(cell(12.5)).toBe("12.5");
    expect(cell(true)).toBe("true");
    expect(cell(["Lighting", "LED"])).toBe("Lighting, LED");
    expect(cell({ a: 1 })).toBe('"{""a"":1}"');
    expect(cell(null)).toBe("");
    expect(cell(undefined)).toBe("");
  });
  it("neutralises formula injection", () => {
    expect(cell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(cell("+45 12 34")).toBe("'+45 12 34");
    expect(cell("-5")).toBe("'-5");
    expect(cell(-5)).toBe("'-5"); // a negative number is fine as text too
  });
  it("writes a BOM, headers and CRLF rows", () => {
    const csv = toCsv([{ tag: "VG-0001", qty: 3 }], [
      { key: "tag", header: "Asset tag", value: (r) => r.tag },
      { key: "qty", header: "Qty", value: (r) => r.qty },
    ]);
    expect(csv).toBe("﻿Asset tag;Qty\r\nVG-0001;3\r\n");
  });
});
