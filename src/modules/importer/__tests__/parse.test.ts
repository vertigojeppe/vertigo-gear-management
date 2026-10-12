import { describe, expect, it } from "vitest";
import { parseAmpsToWatts, parseLoan, parseMoney, parseQuantity, parseVariant, parseWeightKg, readControllers, readFobs, readInventorySheet, readLoans, readProjectors, readRods, readWorkbook } from "../parse";
import { fixtureBytes } from "./fixture";

describe("parse helpers", () => {
  it("reads quantities, exact and not", () => {
    expect(parseQuantity("12")).toEqual({ value: 12, exact: true, raw: "12" });
    expect(parseQuantity("19(old)+ 9 (new)")).toMatchObject({ value: 28, exact: false });
    expect(parseQuantity("mindst 8")).toMatchObject({ value: 8, exact: false });
    expect(parseQuantity("har 4 stk (3 stk)")).toMatchObject({ value: 4, exact: false });
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("ukendt")).toBeNull();
  });
  it("reads weights, amps, money and variants", () => {
    expect(parseWeightKg("~0.8 kg")).toBe(0.8);
    expect(parseWeightKg("6,4kg -kasse")).toBe(6.4);
    expect(parseWeightKg("tung")).toBeNull();
    expect(parseAmpsToWatts("[5 A pr. fixtur]")).toBe(1150);
    expect(parseMoney("1.250,50")).toBe(1250.5);
    expect(parseMoney("900")).toBe(900);
    expect(parseVariant("1,5 m. (tynd)")).toEqual({ label: "1,5 m.", note: "tynd" });
    expect(parseVariant("6 udgange (450w) (Scroller)")).toEqual({ label: "6 udgange", note: "450w, Scroller" });
  });
  it("reads loan cells", () => {
    expect(parseLoan("ukirke", "2")).toEqual({ kind: "loan", name: "ukirke", qty: 2 });
    expect(parseLoan("? !! kan ikke findes", "1")).toMatchObject({ kind: "missing", qty: 1 });
    expect(parseLoan("", "")).toBeNull();
  });
});

describe("sheet readers", () => {
  const M = "fx";
  const load = () => fixtureBytes(M).then((b) => readWorkbook(b, "fixture.xlsx"));

  it("carries category and system down the main sheet and splits states", async () => {
    const wb = await load();
    const rows = readInventorySheet(wb.sheets.get("LED - SCROLLER - BOX")!, "main");
    const five = rows.find((r) => r.variant === "5 m")!;
    expect(five).toMatchObject({ category: "Kabler", system: `True1 ${M} kabler`, price: 25, weightKg: 0.5, total: { value: 10, exact: true }, inRepair: 1, totalSrc: "LED - SCROLLER - BOX!F6" });
    const ten = rows.find((r) => r.variant === "10 m")!;
    expect(ten.total).toMatchObject({ value: 28, exact: false });
    expect(ten.loan).toEqual({ kind: "loan", name: "ukirke", qty: 2 });
    const split = rows.find((r) => r.variant === "60cm")!;
    expect(split).toMatchObject({ category: "LED", system: `SplitLED ${M}`, powerW: 1150, total: { value: 8 } });
    expect(split.note).toContain("Fordelt til 2 stk flightcase");
    const box = rows.find((r) => /4 udgange/.test(r.variant))!;
    expect(box).toMatchObject({ category: "Bokse", system: "BlackLED controller", underConstruction: 1, weightKg: 2 });
    expect(rows.find((r) => r.system === `KITO ${M}`)).toMatchObject({ variant: "500 kg", total: { value: 2 } });
    // Header-only lines (category, system) are not rows.
    expect(rows.map((r) => r.row)).toEqual([6, 7, 10, 13, 15, 17]);
  });

  it("reads controllers, projectors, fobs, loans and rods", async () => {
    const wb = await load();
    const ctl = readControllers(wb.sheets.get("LEDController Optælling")!);
    expect(ctl.map((c) => c.id)).toEqual(["W6-01", "N4-01", "W6-02", "N6-01"]);
    expect(ctl[0]).toMatchObject({ ip: "192.168.1.10", board: "Teensy 4.0", firmware: "v2.1", correctedId: null });
    expect(ctl[2].correctedId).toBe("N4-01");

    const proj = readProjectors(wb.sheets.get("PROJEKTORE")!);
    expect(proj.map((p) => [p.id, p.section])).toEqual([
      ["P1", "own"],
      ["P2", "own"],
      [null, "gearguys"],
      [null, "wish"],
    ]);
    expect(proj[0]).toMatchObject({ lumen: 4500, throwRatio: "1.2:1", dayPrice: 900, serial: "ABCDEFGHIJ12", notForRental: false });
    expect(proj[0].notes).toEqual(["Lånt til LASSE"]);
    expect(proj[1]).toMatchObject({ dayPrice: null, notForRental: true, notes: ["Solgt 2023"] });

    const fobs = readFobs(wb.sheets.get("Nøglebrikker")!);
    expect(fobs.fobs.map((f) => [f.id, f.holder, f.group])).toEqual([
      ["U00001", "Alex", "Hovedindgang"],
      ["U00002", "MANGLER", "Hovedindgang"],
      ["U00003", `Bil ${M}`, "Hovedindgang"],
    ]);
    expect(fobs.notes).toEqual(["Brikker programmeres hos viceværten"]);

    const loans = readLoans(wb.sheets.get("IGANGVÆRENDE UDLEJE")!);
    expect(loans).toHaveLength(1);
    expect(loans[0]).toMatchObject({ date: "12.10.21", price: "5500,- + moms" });
    expect(loans[0].lines.map((l) => [l.qty, l.what])).toEqual([
      [4, "EclGalleryProfile"],
      [2, "True1 5m"],
    ]);

    const rods = readRods(wb.sheets.get("16mm rods")!);
    expect(rods.map((r) => [r.label, r.qty, r.group])).toEqual([
      ["150cm", 31, "16mm rustfri rods"],
      ["200cm", 8, "16mm rustfri rods"],
      ["250cm", 2, "16mm rustfri rods"],
    ]);
  });

  it("rejects a file that is not a workbook", async () => {
    await expect(readWorkbook(Buffer.from("not a zip"), "x.xlsx")).rejects.toThrow();
  });
});
