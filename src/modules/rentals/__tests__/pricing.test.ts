import { describe, expect, it } from "vitest";
import { lineTotal, totals, unitPriceForDays } from "../pricing";

describe("rental pricing", () => {
  it("charges days when only a daily price exists", () => {
    expect(unitPriceForDays({ quantity: 1, pricePerDay: 100, pricePerWeek: null }, 3)).toBe(300);
  });

  it("charges started weeks when only a weekly price exists", () => {
    expect(unitPriceForDays({ quantity: 1, pricePerDay: null, pricePerWeek: 500 }, 7)).toBe(500);
    expect(unitPriceForDays({ quantity: 1, pricePerDay: null, pricePerWeek: 500 }, 8)).toBe(1000);
  });

  it("mixes weeks and days, capping the remainder at a week", () => {
    const line = { quantity: 1, pricePerDay: 100, pricePerWeek: 500 };
    expect(unitPriceForDays(line, 7)).toBe(500);
    expect(unitPriceForDays(line, 9)).toBe(700);
    expect(unitPriceForDays(line, 13)).toBe(1000); // 6 rest days would be 600 > 500
  });

  it("multiplies by quantity and sums with VAT", () => {
    expect(lineTotal({ quantity: 2, pricePerDay: 100, pricePerWeek: null }, "2026-11-10", "2026-11-12")).toBe(600);
    const t = totals([{ quantity: 2, pricePerDay: 100, pricePerWeek: null }, { quantity: 1, pricePerDay: null, pricePerWeek: 500 }], "2026-11-10", "2026-11-12", 0.25);
    expect(t).toEqual({ days: 3, subtotal: 1100, vat: 275, total: 1375 });
  });
});
