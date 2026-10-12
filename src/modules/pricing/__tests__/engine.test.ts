import { describe, expect, it } from "vitest";
import { extraLinePrice, factorFor, gearLinePrice, parseTiers, quoteTotals, type RateTableLike } from "../engine";
import { RATE_TABLE_SEED } from "../../../../prisma/seed/pricing";

const byName = (name: string): RateTableLike => {
  const t = RATE_TABLE_SEED.find((x) => x.name === name)!;
  return { tiers: t.tiers, extraRule: t.extraRule, extraFactor: t.extraFactor };
};

describe("factorFor", () => {
  it("uses the nearest lower tier (step function)", () => {
    const standard = byName("Standard");
    expect(factorFor(standard, 1)).toBe(1);
    expect(factorFor(standard, 3)).toBe(2);
    expect(factorFor(standard, 6)).toBe(2.7); // "5–7 days"
    expect(factorFor(standard, 9)).toBe(2.7);
    expect(factorFor(standard, 10)).toBe(3.6);
    expect(factorFor(standard, 30)).toBe(6.5);
  });
  it("adds per further day beyond the last tier", () => {
    const standard = byName("Standard");
    expect(factorFor(standard, 31)).toBe(6.6); // +10% of day 1 per day
    expect(factorFor(standard, 40)).toBe(7.5);
  });
  it("adds per started block of 10 days", () => {
    const revised = byName("Revised");
    expect(factorFor(revised, 30)).toBe(3.3);
    expect(factorFor(revised, 40)).toBe(3.8);
    expect(factorFor(revised, 35)).toBe(3.8); // started block
    expect(factorFor(revised, 230)).toBe(13.3); // matches the sheet's last row
    const theatre = byName("Theatre");
    expect(factorFor(theatre, 14)).toBe(2.1);
    expect(factorFor(theatre, 180)).toBe(10.8); // 3.3 + 15 × 0.5, as the sheet's "6 md" row
  });
  it("holds the last tier without a rule and the first tier below it", () => {
    const t: RateTableLike = { tiers: [{ days: 2, factor: 1.5 }, { days: 5, factor: 2 }], extraRule: "none", extraFactor: 0 };
    expect(factorFor(t, 1)).toBe(1.5);
    expect(factorFor(t, 99)).toBe(2);
    expect(factorFor({ tiers: [], extraRule: "none", extraFactor: 0 }, 3)).toBe(1);
  });
});

describe("line prices and totals", () => {
  it("prices gear lines with factor, quantity and discount", () => {
    expect(gearLinePrice({ quantity: 2, dayPrice: 400, discountPct: null }, 2)).toEqual({ gross: 1600, discount: 0, net: 1600 });
    expect(gearLinePrice({ quantity: 1, dayPrice: 1000, discountPct: 12.5 }, 1.5)).toEqual({ gross: 1500, discount: 187.5, net: 1312.5 });
    expect(gearLinePrice({ quantity: 3, dayPrice: null, discountPct: 10 }, 2)).toEqual({ gross: 0, discount: 0, net: 0 });
  });
  it("prices extra lines as fixed amounts", () => {
    expect(extraLinePrice({ quantity: 2, unitPrice: 750, discountPct: null })).toEqual({ gross: 1500, discount: 0, net: 1500 });
    expect(extraLinePrice({ quantity: 1, unitPrice: 100, discountPct: 50 })).toEqual({ gross: 100, discount: 50, net: 50 });
  });
  it("applies the document discount before VAT", () => {
    const t = quoteTotals({
      days: 3,
      table: byName("Standard"),
      gearLines: [
        { quantity: 2, dayPrice: 400, discountPct: null },
        { quantity: 1, dayPrice: 200, discountPct: 50 },
      ],
      extraLines: [{ quantity: 1, unitPrice: 300, discountPct: null }],
      discountPct: 10,
      vatRate: 0.25,
    });
    // gear: 2×400×2 = 1600; 1×200×2 = 400 − 50% = 200; extra 300 → 2100; −10% = 1890; VAT 472.5
    expect(t).toEqual({ days: 3, factor: 2, linesTotal: 2100, documentDiscount: 210, subtotal: 1890, vat: 472.5, total: 2362.5 });
  });
  it("rounds money to øre", () => {
    const t = quoteTotals({ days: 1, table: byName("Standard"), gearLines: [{ quantity: 3, dayPrice: 33.33, discountPct: null }], extraLines: [], discountPct: null, vatRate: 0.25 });
    expect(t.subtotal).toBe(99.99);
    expect(t.vat).toBe(25);
    expect(t.total).toBe(124.99);
  });
});

describe("parseTiers", () => {
  it("reads parallel rows, sorts and rejects duplicates", () => {
    expect(parseTiers(["3", "1", ""], ["2", "1,0", ""])).toEqual({ tiers: [{ days: 1, factor: 1 }, { days: 3, factor: 2 }] });
    expect(parseTiers(["1", "1"], ["1", "2"]).error).toMatch(/twice/);
    expect(parseTiers(["0"], ["1"]).error).toMatch(/whole number/);
    expect(parseTiers([], []).error).toMatch(/at least one/);
  });
});
