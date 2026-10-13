import { describe, expect, it } from "vitest";
import { readWorkbook } from "../parse";
import { buildPlan, modelKey, resolveOps, type Op, type PlanContext } from "../plan";
import { fixtureBytes } from "./fixture";

const M = "px";
const empty: PlanContext = { existingModels: new Set(), existingTags: new Set(), users: [{ id: "u1", name: "Alex Admin" }] };
const load = () => fixtureBytes(M).then((b) => readWorkbook(b, "fixture.xlsx"));
const ofType = <T extends Op["type"]>(ops: Op[], type: T) => ops.filter((o): o is Extract<Op, { type: T }> => o.type === type);

describe("buildPlan", () => {
  it("sorts rows into the four buckets with their sources", async () => {
    const plan = await buildPlan(await load(), empty);
    const byKey = Object.fromEntries(plan.rows.map((r) => [r.key, r]));

    // Exact row → import; inexact quantity / loan / power / serialized → assumption with a stated guess.
    expect(byKey["LED - SCROLLER - BOX:6"]).toMatchObject({ bucket: "import", src: "LED - SCROLLER - BOX!F6" });
    expect(byKey["LED - SCROLLER - BOX:7"].bucket).toBe("assumption");
    expect(byKey["LED - SCROLLER - BOX:7"].assumption).toMatch(/read as 28/);
    expect(byKey["LED - SCROLLER - BOX:7"].assumption).toMatch(/"ukirke"/);
    expect(byKey["LED - SCROLLER - BOX:10"].assumption).toMatch(/1150 W/);
    expect(byKey["LED - SCROLLER - BOX:10"].assumption).toMatch(/2 SplitLED flightcases/);
    expect(byKey["LED - SCROLLER - BOX:15"].assumption).toMatch(/2 serialized units/);
    // Controller boxes on the main sheet are only compared with the controller sheet.
    expect(byKey["LED - SCROLLER - BOX:13"]).toMatchObject({ bucket: "assumption", ops: [] });
    expect(byKey["ctl:conflict"].bucket).toBe("decision");
    expect(byKey["ctl:conflict"].summary).toMatch(/4 udgange \(200w\) = 3 \(1 under construction\)/);
    expect(byKey["ctl:conflict"].summary).toMatch(/N4 = 1/);
    // Controller units: ERROR → in repair, corrected id → decision, blank row → unverified.
    expect(byKey["ctl:3"].assumption).toMatch(/in repair/);
    expect(byKey["ctl:4"]).toMatchObject({ bucket: "decision" });
    expect(byKey["ctl:4"].decision?.options.map((o) => o.key)).toEqual(["keep", "skip"]);
    expect(byKey["ctl:5"].assumption).toMatch(/unverified/);
    // Projectors: loan + sold, the GearGuys row goes in the sub-hire catalog, the wish row on the wish list.
    expect(byKey["proj:7"].assumption).toMatch(/with Lasse/);
    expect(byKey["proj:8"].assumption).toMatch(/retired, reason sold/);
    expect(byKey["proj:10"]).toMatchObject({ bucket: "assumption", ops: [{ type: "contact", name: "GearGuys", kind: "company" }, { type: "subhire", ownerName: "GearGuys", manufacturer: "Barco", name: "UDX-4K32", description: "throw 0.8:1 · 4K", categoryPath: ["Video", "Projectors"] }] });
    expect(byKey["proj:12"]).toMatchObject({ bucket: "assumption", ops: [{ type: "wish", manufacturer: "Epson", name: "EB-L1755U", rentalDayPrice: 1200, categoryPath: ["Video", "Projectors"] }] });
    // Fobs: user match, missing, contact.
    expect(byKey["fob:2"].assumption).toMatch(/matched to user Alex Admin/);
    expect(byKey["fob:3"].assumption).toMatch(/missing/);
    expect(byKey["fob:4"].assumption).toMatch(/not a user/);
    // Loan and rods conflicts are decisions; a rod without a stands row is only shown.
    expect(byKey["loan:1"].decision?.defaultKey).toBe("open");
    expect(byKey["rods:2"]).toMatchObject({ bucket: "decision" });
    expect(byKey["rods:2"].summary).toMatch(/31 here vs 30/);
    expect(byKey["rods:3"]).toBeUndefined();
    expect(byKey["rods:4"]).toMatchObject({ bucket: "assumption", ops: [] });

    // Truss quote: purchase records on the two matched models, the baseplate skipped, coating and discount in the notes.
    expect(byKey["truss:quote:57"].bucket).toBe("assumption");
    expect(byKey["truss:quote:57"].assumption).toMatch(/mangler pris/);
    const purchases = byKey["truss:quote:57"].ops.filter((o) => o.type === "purchase");
    expect(purchases).toHaveLength(2);
    expect(purchases[0]).toMatchObject({ type: "purchase", supplierName: "Urs", date: "2025-07-23", reference: "303053885", quantity: 25, listPrice: 3016, discountPct: 40, netPrice: 1809.6, importSource: "Truss!A59" });
    expect((purchases[0] as { notes: string }).notes).toMatch(/Pulver lakering - Truss: 18744 kr · order total 70358.4 kr · invoice discount -7035.84 kr → 63322.56 kr/);
    expect(byKey["truss:quote:57"].ops[0]).toMatchObject({ type: "contact", name: "Urs", kind: "company" });

    // Rate tables are imported with the rule beyond the last tier stated.
    expect(byKey["rate:Standard"]).toMatchObject({ bucket: "assumption", ops: [expect.objectContaining({ type: "rateTable", name: "Standard", isDefault: true, extraRule: "per_day", extraFactor: 0.1, tiers: [{ days: 1, factor: 1 }, { days: 2, factor: 1.5 }, { days: 5, factor: 2.7 }] })] });
    expect(byKey["rate:Theatre"].ops[0]).toMatchObject({ type: "rateTable", extraRule: "per_10_days", extraFactor: 0.5, isDefault: false });
    expect(plan.counts.parked).toBe(0);
    expect(plan.counts.decision).toBe(5);
    expect(plan.counts.import + plan.counts.assumption + plan.counts.decision + plan.counts.parked).toBe(plan.rows.length);
    expect(plan.fileName).toBe("fixture.xlsx");
  });

  it("produces consistent operations for the default decisions", async () => {
    const plan = await buildPlan(await load(), empty);
    const ops = resolveOps(plan, {});
    const models = ofType(ops, "model");
    const keys = models.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length); // no model twice
    const refs = [...ofType(ops, "bin"), ...ofType(ops, "unit"), ...ofType(ops, "kit")].map((o) => o.modelKey);
    for (const k of refs) expect(keys).toContain(k);

    const true1 = models.find((m) => m.name === `True1 ${M} kabler` && m.variant === "5 m")!;
    expect(true1).toMatchObject({ manufacturer: "", categoryPath: ["Cables", `True1 ${M}`], tracking: "bulk", weightKg: 0.5, rentalDayPrice: 25 });
    const bins = ofType(ops, "bin").filter((b) => b.modelKey === true1.key);
    expect(bins.map((b) => [b.quantity, b.status])).toEqual([
      [9, "in_house"],
      [1, "in_repair"],
    ]);
    const lent = ofType(ops, "bin").find((b) => b.personName === "ukirke");
    expect(lent).toMatchObject({ quantity: 2, status: "in_house" });
    expect(ofType(ops, "contact").some((c) => c.name === "ukirke")).toBe(true);
    const split = models.find((m) => m.name === `SplitLED ${M}` && m.variant === "60cm")!;
    expect(split).toMatchObject({ manufacturer: "", powerDrawW: 1150, categoryPath: ["Lighting", "LED"] });
    expect(ofType(ops, "kit")).toEqual([expect.objectContaining({ name: "SplitLED flightcase", count: 2 })]);
    expect(models.find((m) => m.name === "BlackLED controller" && m.variant === "4 udgange (200w)")).toMatchObject({ weightKg: 2, powerDrawW: 200 });
    const units = ofType(ops, "unit");
    expect(units.find((u) => u.assetTag === "N4-91")).toMatchObject({ status: "in_repair", customFields: { ip_address: "192.168.1.20", board_type: "Teensy 3.2" } });
    expect(units.find((u) => u.assetTag === "W6-92")?.notes).toBe("Sheet column M: ID: N4-91");
    expect(units.find((u) => u.assetTag === "ZP1")).toMatchObject({ serialNumber: "ABCDEFGHIJ12", personName: "Lasse" });
    expect(units.find((u) => u.assetTag === "ZP2")).toMatchObject({ status: "retired", retiredReason: "sold", notForRental: true });
    expect(units.find((u) => u.assetTag === "U99901")).toMatchObject({ personName: "Alex Admin" });
    expect(units.find((u) => u.assetTag === "U99902")).toMatchObject({ status: "missing" });
    expect(units.filter((u) => u.modelKey === modelKey("KITO", M, "500 kg"))).toHaveLength(2);
    const rental = ofType(ops, "rental")[0];
    expect(rental).toMatchObject({ clientName: `Testperson ${M}`, startDate: "2021-10-12" });
    expect(rental.lines[0]).toMatchObject({ modelKey: modelKey("ETC", "EclGalleryProfile FC 60W RGBW"), quantity: 4 });
    // Decisions at their defaults: rods keep the stands count, the controller conflict adds nothing.
    expect(ofType(ops, "bin").some((b) => b.notes === "Adjusted per 16mm rods sheet")).toBe(false);
  });

  it("applies decisions and skips what already exists", async () => {
    const wb = await load();
    const plan = buildPlan(wb, empty);
    const chosen = resolveOps(plan, { "rods:2": "rods", "ctl:4": "skip", "loan:1": "closed" });
    expect(ofType(chosen, "bin").find((b) => b.notes === "Adjusted per 16mm rods sheet")).toMatchObject({ quantity: 1 });
    expect(ofType(chosen, "unit").some((u) => u.assetTag === "W6-92")).toBe(false);
    expect(ofType(chosen, "rental")).toHaveLength(0);

    const ctx: PlanContext = { ...empty, existingModels: new Set([modelKey("", `True1 ${M} kabler`, "5 m")]), existingTags: new Set(["W6-91", "ZP1"]) };
    const again = buildPlan(wb, ctx);
    const byKey = Object.fromEntries(again.rows.map((r) => [r.key, r]));
    expect(byKey["LED - SCROLLER - BOX:6"].bucket).toBe("decision");
    expect(byKey["LED - SCROLLER - BOX:6"].decision?.options.map((o) => o.key)).toEqual(["skip", "add"]);
    expect(byKey["ctl:2"]).toMatchObject({ bucket: "decision", summary: "W6-91: asset tag already exists" });
    expect(byKey["proj:7"].bucket).toBe("decision");
    const ops = resolveOps(again, {});
    expect(ofType(ops, "model").some((m) => m.name === `True1 ${M} kabler 5 m`)).toBe(false);
    expect(ofType(ops, "unit").some((u) => u.assetTag === "W6-91" || u.assetTag === "ZP1")).toBe(false);
    // "Add to the existing model" keeps the bins but not the model.
    const add = resolveOps(again, { "LED - SCROLLER - BOX:6": "add" });
    expect(ofType(add, "bin").filter((b) => b.modelKey === modelKey("", `True1 ${M} kabler`, "5 m"))).toHaveLength(2);
  });
});
