import { describe, expect, it } from "vitest";
import { canCheckIn, canCheckOut, canEditLines, lineProgress, listProgress, listTotals, outcomeItemStatus } from "../logic";

describe("lineProgress", () => {
  it("counts packed and remaining for serialized lines", () => {
    const p = lineProgress({ quantity: 3, trackingType: "serialized", checks: [{ phase: "out", quantity: 1, outcome: "ok" }, { phase: "out", quantity: 1, outcome: "ok" }] });
    expect(p.packed).toBe(2);
    expect(p.toPack).toBe(1);
    expect(p.toReturn).toBe(2);
  });

  it("handles bulk partial returns and outcomes", () => {
    const p = lineProgress({
      quantity: 10,
      trackingType: "bulk",
      checks: [
        { phase: "out", quantity: 10, outcome: "ok" },
        { phase: "in", quantity: 7, outcome: "ok" },
        { phase: "in", quantity: 2, outcome: "damaged" },
      ],
    });
    expect(p.packed).toBe(10);
    expect(p.toPack).toBe(0);
    expect(p.returnedOk).toBe(7);
    expect(p.damaged).toBe(2);
    expect(p.missing).toBe(0);
    expect(p.toReturn).toBe(1);
  });

  it("never goes negative when more was packed than planned", () => {
    const p = lineProgress({ quantity: 1, trackingType: "serialized", checks: [{ phase: "out", quantity: 1, outcome: "ok" }, { phase: "out", quantity: 1, outcome: "ok" }] });
    expect(p.toPack).toBe(0);
  });
});

describe("listProgress and totals", () => {
  it("sums lines and counts complete ones", () => {
    const t = listProgress([
      { quantity: 2, trackingType: "serialized", checks: [{ phase: "out", quantity: 1, outcome: "ok" }, { phase: "out", quantity: 1, outcome: "ok" }] },
      { quantity: 5, trackingType: "bulk", checks: [] },
    ]);
    expect(t.units).toBe(7);
    expect(t.packed).toBe(2);
    expect(t.toPack).toBe(5);
    expect(t.linesComplete).toBe(1);
  });

  it("computes weight, power and cases", () => {
    const t = listTotals([
      { quantity: 2, weightKg: 24, powerDrawW: 800, isCase: false },
      { quantity: 1, weightKg: 28, powerDrawW: null, isCase: true, kitContentsWeightKg: 14.5 },
      { quantity: 3, weightKg: null, powerDrawW: null, isCase: false },
    ]);
    expect(t.weightKg).toBe(90.5);
    expect(t.powerW).toBe(1600);
    expect(t.cases).toBe(1);
    expect(t.unknownWeight).toBe(3);
  });
});

describe("transitions", () => {
  const nothing = listProgress([]);
  const some = listProgress([{ quantity: 1, trackingType: "serialized", checks: [{ phase: "out", quantity: 1, outcome: "ok" }] }]);
  it("only drafts can be edited, packed and checked out, only checked-out lists checked in", () => {
    expect(canEditLines("draft")).toBe(true);
    expect(canEditLines("checked_out")).toBe(false);
    expect(canCheckOut("draft", nothing)).toBe(false);
    expect(canCheckOut("draft", some)).toBe(true);
    expect(canCheckOut("checked_out", some)).toBe(false);
    expect(canCheckIn("checked_out")).toBe(true);
    expect(canCheckIn("draft")).toBe(false);
    expect(canCheckIn("checked_in")).toBe(false);
  });

  it("maps outcomes to item statuses from config", () => {
    expect(outcomeItemStatus("ok")).toBe("in_house");
    expect(outcomeItemStatus("damaged")).toBe("in_repair");
    expect(outcomeItemStatus("missing")).toBe("missing");
  });
});
