import { describe, expect, it } from "vitest";
import { planTrackingChange, type TrackingUnit } from "../tracking-change";

const unit = (assetTag: string, over: Partial<TrackingUnit> = {}): TrackingUnit => ({ id: assetTag, assetTag, status: "in_house", quantity: 1, isKit: false, contents: 0, parentItemId: null, ...over });

describe("planTrackingChange", () => {
  it("merges in-house loose units into the lowest tag and leaves the rest as their own rows", () => {
    const plan = planTrackingChange("serialized", [unit("VG-0010"), unit("VG-0009"), unit("VG-0100"), unit("VG-0011", { status: "on_project" }), unit("VG-0012", { parentItemId: "case" })]);
    expect("blocked" in plan).toBe(false);
    if ("blocked" in plan || plan.to !== "bulk") return;
    expect(plan.keep?.assetTag).toBe("VG-0009"); // numeric order, not text order
    expect(plan.merge.map((u) => u.assetTag)).toEqual(["VG-0010", "VG-0100"]);
    expect(plan.stay.map((u) => u.assetTag)).toEqual(["VG-0011", "VG-0012"]);
  });

  it("refuses to merge cases with contents", () => {
    expect(planTrackingChange("serialized", [unit("VG-1", { isKit: true, contents: 3 })])).toEqual({ to: "bulk", blocked: "VG-1 is a case with contents; only loose units can become a bin." });
  });

  it("splits bins of several in house and counts the new units", () => {
    const plan = planTrackingChange("bulk", [unit("VG-2", { quantity: 4 }), unit("VG-1", { quantity: 2 }), unit("VG-3", { status: "in_repair" })]);
    if ("blocked" in plan || plan.to !== "serialized") throw new Error("expected a split");
    expect(plan.split.map((u) => u.assetTag)).toEqual(["VG-1", "VG-2"]);
    expect(plan.newUnits).toBe(4);
    expect(plan.stay.map((u) => u.assetTag)).toEqual(["VG-3"]);
  });

  it("refuses to split a bin of several that is out", () => {
    expect(planTrackingChange("bulk", [unit("VG-7", { quantity: 3, status: "on_project" })])).toEqual({ to: "serialized", blocked: "VG-7 (3) is not in house; check it in first." });
  });
});
