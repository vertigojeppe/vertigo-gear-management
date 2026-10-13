import { modelLabel } from "@/lib/format";
import type { Workbook, Src, InventoryRow, ProjectorRow, ControllerRow } from "./parse";
import { readInventorySheet, readControllers, readProjectors, readComputers, readTruss, readRods, readFobs, readLoans, readQled, readRateTables, parseVariant } from "./parse";

/**
 * Turns the parsed workbook into an import plan: a list of rows, each in
 * one of four buckets, with the operations it would perform. Nothing here
 * touches the database; `commit.ts` applies a plan. Every row carries the
 * cell it came from and, when a human has to choose, the options.
 *
 *  - import      → will be written as read
 *  - assumption  → will be written, with a stated guess
 *  - decision    → written only after you pick an option
 *  - parked      → belongs to a feature that is not built yet (pricing,
 *                  wish list, sub-hire, purchase records); shown, not written
 */

export type Bucket = "import" | "assumption" | "decision" | "parked";

export type ModelOp = {
  type: "model";
  key: string; // "manufacturer|name|variant" lower-cased, used by later ops
  categoryPath: string[];
  manufacturer: string;
  name: string;
  variant?: string | null;
  tracking: "serialized" | "bulk";
  weightKg?: number | null;
  powerDrawW?: number | null;
  rentalDayPrice?: number | null;
  notForRental?: boolean;
  notes?: string | null;
  customFields?: Record<string, string | number>;
  importSource: Src;
};
export type BinOp = { type: "bin"; modelKey: string; quantity: number; status: string; retiredReason?: string; locationName?: string; personName?: string; notes?: string | null; importSource: Src };
export type UnitOp = {
  type: "unit";
  modelKey: string;
  assetTag?: string;
  name?: string;
  serialNumber?: string | null;
  status: string;
  retiredReason?: string;
  notForRental?: boolean;
  locationName?: string;
  personName?: string;
  conditionNotes?: string | null;
  notes?: string | null;
  customFields?: Record<string, string | number>;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  importSource: Src;
};
export type KitOp = { type: "kit"; modelKey: string; name: string; count: number; importSource: Src };
export type ContactOp = { type: "contact"; name: string; kind: "person" | "company"; notes?: string; importSource: Src };
export type LocationOp = { type: "location"; name: string; kind: "warehouse" | "person"; contactName?: string; importSource: Src };
export type RentalOp = { type: "rental"; clientName: string; startDate: string; endDate: string; notes: string; lines: { modelKey: string | null; quantity: number; text: string }[]; importSource: Src };
export type NoteOp = { type: "modelNote"; modelKey: string; note: string };
export type RateTableOp = { type: "rateTable"; name: string; isDefault: boolean; extraRule: "none" | "per_day" | "per_10_days"; extraFactor: number; notes: string | null; tiers: { days: number; factor: number }[]; importSource: Src };
export type Op = ModelOp | BinOp | UnitOp | KitOp | ContactOp | LocationOp | RentalOp | NoteOp | RateTableOp;

export type Decision = { question: string; options: { key: string; label: string; ops: Op[] }[]; defaultKey: string };

export type PlanRow = {
  key: string;
  sheet: string;
  src: Src;
  bucket: Bucket;
  summary: string;
  assumption?: string;
  decision?: Decision;
  ops: Op[];
  parked?: { feature: string; detail: string };
};

export type Plan = { rows: PlanRow[]; counts: Record<Bucket, number>; fileName: string };

export type PlanContext = {
  /** "manufacturer|name" (lower-cased) of models that already exist. */
  existingModels: Set<string>;
  /** Asset tags already in use. */
  existingTags: Set<string>;
  /** Active users, to match key-fob holders and loans by first name. */
  users: { id: string; name: string }[];
};

/* Helpers ---------------------------------------------------------------- */

const low = (s: string) => s.trim().toLowerCase();
export const modelKey = (manufacturer: string, name: string, variant: string | null = null) => `${low(manufacturer)}|${low(name)}|${low(variant ?? "")}`;

function cleanLabel(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s*\.\s*$/, "")
    .replace(/\s*!\s*$/, "")
    .trim();
}

/** The sheet's system column is the family, its size column the variant: "Scroller" + "1,5 m. (tynd)" → { name: "Scroller", variant: "1,5 m (tynd)" }. */
function splitName(system: string, variant: string): { name: string; variant: string | null } {
  const { label, note } = parseVariant(variant);
  const v = cleanLabel([label, note ? `(${note})` : ""].filter(Boolean).join(" "));
  return { name: cleanLabel(system), variant: v || null };
}
const labelOf = (x: { manufacturer: string; name: string; variant: string | null }) => modelLabel(x);

function manufacturerFor(system: string): string {
  if (/^manfrotto/i.test(system)) return "Manfrotto";
  if (/^kito/i.test(system)) return "KITO";
  if (/mitari/i.test(system)) return "Mitari";
  if (/eclgalleryprofile/i.test(system)) return "ETC";
  // Own-built gear (LED systems, controllers, alu, podium legs) and generic consumables
  // (cables, rods, clamps) carry no manufacturer: the label is just the name.
  return "";
}

function categoryFor(row: InventoryRow): string[] {
  const c = row.category;
  const s = row.system;
  if (/^kabler$/i.test(c)) return ["Cables", cleanLabel(s.replace(/\s*kabler$/i, "")).slice(0, 60)];
  if (/^bokse$/i.test(c)) return ["Lighting", "LED controllers"];
  if (/^LED$/i.test(c)) return ["Lighting", "LED"];
  if (/^lamper$/i.test(c)) return ["Lighting", "Conventional"];
  if (/^network$/i.test(c)) return ["Computers & networking"];
  if (/^laser/i.test(c)) return ["Laser", "Mirrors"];
  if (/^stativer$/i.test(c)) {
    if (/rods|space 10|forlænger stykker|adapter/i.test(s)) return ["Rigging", "Rods & bases"];
    if (/magic arm|beslag|L stykker/i.test(s)) return ["Rigging", "Clamps & hardware"];
    if (/kito|mitari/i.test(s)) return ["Rigging", "Motors & hoists"];
    return ["Rigging", "Stands"];
  }
  if (/^clamps$/i.test(c)) return ["Rigging", "Clamps & hardware"];
  if (/^alu$/i.test(c)) return ["Rigging", "Alu profiles"];
  if (/melo/i.test(c)) return ["Rigging", "Podium legs"];
  return ["Uncategorised"];
}

function finishFor(text: string): { finish?: "Raw alu" | "Black painted"; note?: string } {
  const t = low(text);
  if (!t) return {};
  if (/sortmalede|sort malet/.test(t) && !/rå/.test(t)) return { finish: "Black painted" };
  if (/rå alu/.test(t) && !/sort/.test(t)) return { finish: "Raw alu" };
  return { note: text };
}

/* Inventory sheets --------------------------------------------------------- */

function inventoryRows(rows: InventoryRow[], ctx: PlanContext, opts: { preferQledSheet?: boolean; controllersFromSheet?: boolean } = {}): PlanRow[] {
  const out: PlanRow[] = [];
  const seenModels = new Map<string, Src>();
  for (const r of rows) {
    const key = `${r.sheet}:${r.row}`;
    const system = r.system || r.category;
    const isAlu = /^alu$/i.test(r.category) && !/hjørner/i.test(system);
    const manufacturer = manufacturerFor(system);
    const { name: famName, variant } = splitName(isAlu ? "35×35 mm alu profile" : system, r.variant);
    const name = labelOf({ manufacturer, name: famName, variant });
    const mkey = modelKey(manufacturer, famName, variant);
    const categoryPath = categoryFor(r);
    const assumptions: string[] = [];
    const serialized = /EclGalleryProfile|KITO|Wind Up|Follow Spot/i.test(system);
    const notes: string[] = [r.note, r.extras.filter((e) => !/^G:|^N:/.test(e)).join("; ")].filter(Boolean);
    const cf: Record<string, string | number> = {};
    let finishNote: string | undefined;
    if (isAlu) {
      const f = finishFor(r.minusRepMissing);
      if (f.finish) cf.finish = f.finish;
      if (f.note) finishNote = f.note;
    }
    if (/^bokse$/i.test(r.category) && opts.controllersFromSheet) {
      out.push({ key, sheet: r.sheet, src: r.totalSrc, bucket: "assumption", summary: `${name}: ${r.total?.value ?? "?"} on this sheet — units come from "LEDController Optælling"`, assumption: "The controller sheet lists every unit by ID, so it is used for the units; this count is only compared (see the decision row).", ops: [] });
      continue;
    }
    if (/^kabler$/i.test(r.category) && /^lp12 "qled"/i.test(system) && opts.preferQledSheet) {
      out.push({ key, sheet: r.sheet, src: r.totalSrc, bucket: "assumption", summary: `${name}: ${r.total?.value ?? "?"} on this sheet — superseded by the QLED recount (21.07.25)`, assumption: "The QLED sheet's newer count is used; this row is only shown for comparison.", ops: [] });
      continue;
    }
    const ops: Op[] = [];
    const existing = ctx.existingModels.has(mkey);
    const firstSeen = !seenModels.has(mkey);
    if (firstSeen) {
      seenModels.set(mkey, r.systemSrc);
      ops.push({
        type: "model",
        key: mkey,
        categoryPath,
        manufacturer,
        name: famName,
        variant,
        tracking: serialized ? "serialized" : "bulk",
        weightKg: r.weightKg,
        powerDrawW: r.powerW,
        rentalDayPrice: r.price,
        notes: [...notes, finishNote].filter(Boolean).join(" · ") || null,
        customFields: Object.keys(cf).length ? cf : undefined,
        importSource: r.totalSrc,
      });
    } else if (notes.length || finishNote) {
      ops.push({ type: "modelNote", modelKey: mkey, note: [...notes, finishNote].filter(Boolean).join(" · ") });
    }
    const total = r.total?.value ?? null;
    if (total === null) {
      out.push({ key, sheet: r.sheet, src: r.totalSrc, bucket: "assumption", summary: `${name}: no quantity on the sheet`, assumption: `Model created${r.weightKg ? ` with weight ${r.weightKg} kg` : ""}; no units. Add them when you count.`, ops });
      continue;
    }
    if (r.total && !r.total.exact) assumptions.push(`Quantity "${r.total.raw}" read as ${total}.`);
    if (r.powerW) assumptions.push(`Power ${r.powerW} W from "${r.note.match(/\[[^\]]+\]/)?.[0] ?? "amps"}" at 230 V.`);
    // Split the total into bins by state.
    const loanQty = r.loan?.kind === "loan" ? r.loan.qty : 0;
    const missingQty = r.missing + (r.loan?.kind === "missing" ? r.loan.qty : 0);
    const repairQty = r.inRepair;
    const ucQty = r.underConstruction;
    const brokenMatch = r.minusRepMissing.match(/\((\d+)\s*broken\)/i);
    const extraRepair = brokenMatch ? Number(brokenMatch[1]) : 0;
    const lentMatch = r.minusRepMissing.match(/(\w+)\s+har\s+(\d+)\s*stk/i);
    const lentName = lentMatch ? lentMatch[1] : null;
    const lentQty = lentMatch ? Number(lentMatch[2]) : 0;
    const inHouse = Math.max(0, total - loanQty - missingQty - repairQty - ucQty - extraRepair - lentQty);
    const bins: BinOp[] = [];
    const mk = (quantity: number, status: string, extra: Partial<BinOp> = {}) => quantity > 0 && bins.push({ type: "bin", modelKey: mkey, quantity, status, importSource: r.totalSrc, ...extra });
    if (serialized) {
      for (let i = 0; i < total; i++) ops.push({ type: "unit", modelKey: mkey, status: i < repairQty ? "in_repair" : "in_house", importSource: r.totalSrc });
      assumptions.push(`${total} serialized units created without serial numbers.`);
    } else {
      mk(inHouse, "in_house");
      mk(repairQty + extraRepair, "in_repair", { notes: "In repair per spreadsheet" });
      mk(missingQty, "missing", { notes: r.loan?.kind === "missing" ? r.loan.raw : "Missing per spreadsheet" });
      mk(ucQty, "under_construction");
      if (loanQty && r.loan?.kind === "loan") {
        ops.push({ type: "contact", name: r.loan.name, kind: "person", importSource: r.totalSrc });
        ops.push({ type: "location", name: r.loan.name, kind: "person", contactName: r.loan.name, importSource: r.totalSrc });
        mk(loanQty, "in_house", { personName: r.loan.name, notes: `Lent out per spreadsheet (Udlån)` });
        assumptions.push(`${loanQty} with "${r.loan.name}": a contact and a person location are created.`);
      }
      if (lentQty && lentName) {
        ops.push({ type: "contact", name: lentName, kind: "person", importSource: r.totalSrc });
        ops.push({ type: "location", name: lentName, kind: "person", contactName: lentName, importSource: r.totalSrc });
        mk(lentQty, "in_house", { personName: lentName, notes: "Per spreadsheet note" });
        assumptions.push(`"${r.minusRepMissing}": ${extraRepair} in repair, ${lentQty} with ${lentName}.`);
      }
      ops.push(...bins);
    }
    if (/Fordelt til (\d+) stk flightcase/i.test(r.note)) {
      const cases = Number(r.extras.join(" ").match(/(\d+) SplitLED flightcases/i)?.[1] ?? r.note.match(/Fordelt til (\d+)/i)?.[1] ?? 0);
      if (cases > 0) {
        const caseKey = modelKey("", "SplitLED flightcase");
        ops.push({ type: "model", key: caseKey, categoryPath: ["Cases & storage"], manufacturer: "", name: "SplitLED flightcase", tracking: "serialized", importSource: r.totalSrc, notes: r.extras.join(" ") });
        ops.push({ type: "kit", modelKey: caseKey, name: "SplitLED flightcase", count: cases, importSource: r.totalSrc });
        assumptions.push(`${cases} SplitLED flightcases created as empty kits (which fixtures sit in which case is not in the sheet).`);
      }
    }
    if (/i (\d+) stk .*taske/i.test(r.note)) {
      const n = Number(r.note.match(/i (\d+) stk/i)![1]);
      const bagKey = modelKey("Manfrotto", "LBAG110 padded bag");
      ops.push({ type: "model", key: bagKey, categoryPath: ["Cases & storage"], manufacturer: "Manfrotto", name: "LBAG110 padded bag", tracking: "serialized", importSource: r.totalSrc });
      ops.push({ type: "kit", modelKey: bagKey, name: "Manfrotto LBAG110 bag", count: n, importSource: r.totalSrc });
      assumptions.push(`${n} Manfrotto LBAG110 bags created as empty kits.`);
    }
    const stateText = [repairQty + extraRepair ? `${repairQty + extraRepair} in repair` : "", missingQty ? `${missingQty} missing` : "", ucQty ? `${ucQty} under construction` : "", loanQty ? `${loanQty} lent out` : "", lentQty ? `${lentQty} with ${lentName}` : ""].filter(Boolean).join(", ");
    const summary = `${categoryPath.join(" › ")} › ${name}: ${total}${stateText ? ` (${stateText})` : ""}`;
    if (existing) {
      out.push({
        key,
        sheet: r.sheet,
        src: r.totalSrc,
        bucket: "decision",
        summary: `${summary} — a model "${name}" already exists`,
        decision: { question: "This model is already in the inventory.", defaultKey: "skip", options: [{ key: "skip", label: "Skip this row", ops: [] }, { key: "add", label: "Add these units to the existing model", ops: ops.filter((o) => o.type !== "model") }] },
        ops: [],
      });
      continue;
    }
    out.push({ key, sheet: r.sheet, src: r.totalSrc, bucket: assumptions.length ? "assumption" : "import", summary, assumption: assumptions.join(" ") || undefined, ops });
  }
  return out;
}

/* Sheet-specific builders ------------------------------------------------- */

function controllerRows(rows: ControllerRow[], ctx: PlanContext, weights: Record<string, number | null> = {}): PlanRow[] {
  const out: PlanRow[] = [];
  const models: Record<string, { name: string; variant: string; note: string; weightKg: number | null; powerDrawW: number }> = {
    W6: { name: "BlackLED controller", variant: "6 udgange (450w) (Wieland)", note: "W6 = Wieland 6-out", weightKg: weights.W6 ?? null, powerDrawW: 450 },
    N6: { name: "BlackLED controller", variant: "6 udgange (450w) (Scroller)", note: "N6 = 6-out (Scroller)", weightKg: weights.N6 ?? null, powerDrawW: 450 },
    N4: { name: "BlackLED controller", variant: "4 udgange (200w)", note: "N4 = 4-out", weightKg: weights.N4 ?? null, powerDrawW: 200 },
  };
  const seen = new Set<string>();
  for (const c of rows) {
    const prefix = c.id.split("-")[0];
    const m = models[prefix];
    if (!m) continue;
    const mkey = modelKey("", m.name, m.variant);
    const ops: Op[] = [];
    const tagExists = ctx.existingTags.has(c.id);
    const cf: Record<string, string> = {};
    if (c.ip) cf.ip_address = c.ip;
    if (c.board) cf.board_type = /4\.0/.test(c.board) ? "Teensy 4.0" : /4/.test(c.board) ? "Teensy 4" : "Teensy 3.2";
    if (c.firmware) cf.firmware = c.firmware;
    const error = /error/i.test(c.status);
    const unit: UnitOp = { type: "unit", modelKey: mkey, assetTag: c.id, status: error ? "in_repair" : "in_house", conditionNotes: error ? c.status : null, customFields: cf, importSource: c.idSrc };
    const assumptions: string[] = [];
    if (!seen.has(prefix)) {
      seen.add(prefix);
      assumptions.push(`ID prefix ${prefix} read as "${m.name} ${m.variant}" (${m.note}); confirm.`);
    }
    if (!c.ip && !c.board) assumptions.push("No data on the sheet: created in house, unverified.");
    if (error) assumptions.push(`Status "${c.status}" → in repair.`);
    ops.push(unit);
    if (tagExists) {
      out.push({ key: `ctl:${c.row}`, sheet: "LEDController Optælling", src: c.idSrc, bucket: "decision", summary: `${c.id}: asset tag already exists`, decision: { question: "An item with this tag is already in the inventory.", defaultKey: "skip", options: [{ key: "skip", label: "Skip", ops: [] }] }, ops: [] });
      continue;
    }
    if (c.correctedId && c.correctedId !== c.id) {
      out.push({
        key: `ctl:${c.row}`,
        sheet: "LEDController Optælling",
        src: c.idSrc,
        bucket: "decision",
        summary: `${c.id} (column M says "ID: ${c.correctedId}", which is also its own row)`,
        decision: {
          question: "Which ID is right for this row?",
          defaultKey: "keep",
          options: [
            { key: "keep", label: `Keep ${c.id} and note the correction`, ops: [{ ...unit, notes: `Sheet column M: ID: ${c.correctedId}` }] },
            { key: "skip", label: `Skip this row (it duplicates ${c.correctedId})`, ops: [] },
          ],
        },
        ops: [],
      });
      continue;
    }
    out.push({ key: `ctl:${c.row}`, sheet: "LEDController Optælling", src: c.idSrc, bucket: assumptions.length ? "assumption" : "import", summary: `${m.name} ${m.variant} › ${c.id}${c.ip ? ` · ${c.ip}` : ""}${c.board ? ` · ${c.board}` : ""}${error ? ` · ${c.status}` : ""}`, assumption: assumptions.join(" ") || undefined, ops });
  }
  // The models themselves (one row each), with the counts from the main sheet for comparison.
  for (const [prefix, m] of Object.entries(models)) {
    const n = rows.filter((c) => c.id.startsWith(prefix)).length;
    const mkey = modelKey("", m.name, m.variant);
    out.unshift({ key: `ctl:model:${prefix}`, sheet: "LEDController Optælling", src: `LEDController Optælling!B1`, bucket: ctx.existingModels.has(mkey) ? "assumption" : "import", summary: `Lighting › LED controllers › ${m.name} ${m.variant}: ${n} serialized units from this sheet`, assumption: ctx.existingModels.has(mkey) ? "Model already exists; units are added to it." : undefined, ops: ctx.existingModels.has(mkey) ? [] : [{ type: "model", key: mkey, categoryPath: ["Lighting", "LED controllers"], manufacturer: "", name: m.name, variant: m.variant, tracking: "serialized", weightKg: m.weightKg, powerDrawW: m.powerDrawW, importSource: `LEDController Optælling!B1` }] });
  }
  return out;
}

function projectorRows(rows: ProjectorRow[], ctx: PlanContext): PlanRow[] {
  const out: PlanRow[] = [];
  const seen = new Set<string>();
  let generated = 0;
  for (const p of rows) {
    const key = `proj:${p.row}`;
    if (p.section === "gearguys") {
      out.push({ key, sheet: "PROJEKTORE", src: p.modelSrc, bucket: "parked", summary: `GearGuys: ${p.model}${p.throwRatio ? ` · ${p.throwRatio}` : ""}${p.resolution ? ` · ${p.resolution}` : ""}`, ops: [], parked: { feature: "Sub-hire catalog", detail: "Gear GearGuys owns; goes into the partner / sub-hire catalog when that feature is built (backlog)." } });
      continue;
    }
    if (p.section === "wish") {
      out.push({ key, sheet: "PROJEKTORE", src: p.modelSrc, bucket: "parked", summary: `Wish: ${p.model}${p.dayPrice ? ` · ${p.dayPrice} kr` : ""}${p.notes.length ? ` · ${p.notes[0]}` : ""}`, ops: [], parked: { feature: "Wish list", detail: "Models to buy; goes into the wish list when that feature is built (backlog)." } });
      continue;
    }
    const manufacturer = p.model.split(/\s+/)[0];
    const name = p.model.replace(/\s*-\s*LCD!?$/i, "").trim();
    const mkey = modelKey(manufacturer, name);
    const ops: Op[] = [];
    const assumptions: string[] = [];
    if (!seen.has(mkey)) {
      seen.add(mkey);
      const cf: Record<string, string | number> = {};
      if (p.lumen) cf.lumen = p.lumen;
      if (p.throwRatio) cf.throw_ratio = p.throwRatio;
      if (p.lensShift) cf.lens_shift = p.lensShift;
      if (p.resolution) cf.resolution = p.resolution;
      if (!ctx.existingModels.has(mkey)) {
        ops.push({ type: "model", key: mkey, categoryPath: ["Video", "Projectors", "Lamp projectors"], manufacturer, name, tracking: "serialized", rentalDayPrice: p.dayPrice, notForRental: p.notForRental, customFields: cf, importSource: p.modelSrc });
      }
    }
    const sold = p.notes.find((n) => /^solgt/i.test(n));
    const loan = p.notes.find((n) => /lånt til/i.test(n));
    const condition = p.notes.filter((n) => !/^solgt|lånt til|^http|bremen/i.test(n)).join(" · ") || null;
    let assetTag = p.id ?? undefined;
    if (!assetTag) {
      generated++;
      assetTag = `L${generated}`;
      assumptions.push(`No ID on the sheet: tag ${assetTag} generated.`);
    }
    if (ctx.existingTags.has(assetTag)) {
      out.push({ key, sheet: "PROJEKTORE", src: p.idSrc, bucket: "decision", summary: `${assetTag} ${p.model}: asset tag already exists`, decision: { question: "An item with this tag is already in the inventory.", defaultKey: "skip", options: [{ key: "skip", label: "Skip", ops: [] }] }, ops: [] });
      continue;
    }
    const unit: UnitOp = { type: "unit", modelKey: mkey, assetTag, serialNumber: p.serial, status: "in_house", notForRental: p.notForRental, conditionNotes: condition, importSource: p.idSrc, customFields: {} };
    if (sold) {
      unit.status = "retired";
      unit.retiredReason = "sold";
      unit.notes = sold;
      assumptions.push(`"${sold}" → retired, reason sold.`);
    }
    if (p.location) {
      ops.push({ type: "location", name: p.location, kind: "warehouse", importSource: p.idSrc });
      unit.locationName = p.location;
      assumptions.push(`Location "${p.location}" created as a warehouse location.`);
    }
    if (loan) {
      const who = loan.match(/lånt til\s+([A-ZÆØÅa-zæøå]+)/i)?.[1] ?? "Unknown";
      const person = who.charAt(0) + who.slice(1).toLowerCase();
      ops.push({ type: "contact", name: person, kind: "person", importSource: p.idSrc });
      ops.push({ type: "location", name: person, kind: "person", contactName: person, importSource: p.idSrc });
      unit.personName = person;
      unit.notes = loan;
      assumptions.push(`"${loan}" → with ${person} (contact + person location).`);
    }
    if (p.notForRental) assumptions.push("ikke til udleje → not for rental.");
    ops.push(unit);
    out.push({ key, sheet: "PROJEKTORE", src: p.idSrc, bucket: assumptions.length ? "assumption" : "import", summary: `${modelLabel({ manufacturer, name })} › ${assetTag}${p.serial ? ` · SN ${p.serial}` : ""}${sold ? " · sold" : ""}${p.notForRental ? " · not for rental" : ""}`, assumption: assumptions.join(" ") || undefined, ops });
  }
  const stray = rows.length ? [{ key: "proj:note84", sheet: "PROJEKTORE", src: "PROJEKTORE!L84", bucket: "decision" as Bucket, summary: `"Lasse har købe 9 stk … fra 2014 'lidt gammle'" stands alone on the sheet`, decision: { question: "Which model does this note belong to?", defaultKey: "skip", options: [{ key: "skip", label: "Skip the note", ops: [] }, { key: "nec", label: "Attach to NEC P554U", ops: [{ type: "modelNote" as const, modelKey: modelKey("NEC", "NEC P554U"), note: "Lasse har købe 9 stk … fra 2014 'lidt gammle' (sheet row 84)" }] }] }, ops: [] }] : [];
  return [...out, ...stray];
}

function serverOps(s: { name: string; cpu: string; ram: string; storage: string; psu: string; purchaseDate: string | null; basePrices: number[]; notes: string[]; src: Src }, serverKey: string, day: number | null, ctx: PlanContext): Op[] {
  const ops: Op[] = [];
  if (!ctx.existingTags.has(s.name)) ops.push({ type: "unit", modelKey: serverKey, assetTag: s.name, name: s.name, status: "in_house", purchaseDate: s.purchaseDate, purchasePrice: s.basePrices.reduce((a, b) => a + b, 0) || null, customFields: { cpu: s.cpu, ram: s.ram, storage: s.storage, psu: s.psu }, notes: s.notes.join(" · ") || null, importSource: s.src });
  if (day !== null) ops.push({ type: "modelNote", modelKey: serverKey, note: `Rental day price per server ≈ ${day} kr (components / 10, 30% off)` });
  return ops;
}

/* Whole-workbook plan ----------------------------------------------------- */

export function buildPlan(wb: Workbook, ctx: PlanContext): Plan {
  const rows: PlanRow[] = [];
  const sheet = (n: string) => wb.sheets.get(n);

  const main = sheet("LED - SCROLLER - BOX");
  if (main) rows.push(...inventoryRows(readInventorySheet(main, "main"), ctx, { preferQledSheet: Boolean(sheet("QLED")), controllersFromSheet: Boolean(sheet("LEDController Optælling")) }));

  const qled = sheet("QLED");
  if (qled) {
    for (const q of readQled(qled)) {
      const key = `qled:${q.row}`;
      if (q.section === "old") {
        rows.push({ key, sheet: "QLED", src: q.src, bucket: "assumption", summary: `Old count: ${q.system} ${q.variant} = ${q.qty}`, assumption: "Superseded by the 21.07.25 recount below; shown for comparison only.", ops: [] });
        continue;
      }
      const system = q.section === "accessories" ? q.system : q.system.replace(/^LP12 Leftover$/i, "LP12 QLED (leftover)").replace(/^QLED set$/i, "QLED set");
      const split = splitName(system, q.variant);
      const name = labelOf({ manufacturer: "", ...split });
      const mkey = modelKey("", split.name, split.variant);
      const catPath = q.section === "accessories" ? ["Cables", "Adapters"] : ["Cables", "QLED"];
      if (ctx.existingModels.has(mkey)) {
        rows.push({ key, sheet: "QLED", src: q.src, bucket: "decision", summary: `${name}: ${q.qty} — model already exists`, decision: { question: "This model is already in the inventory.", defaultKey: "skip", options: [{ key: "skip", label: "Skip", ops: [] }, { key: "add", label: "Add the quantity", ops: q.qty ? [{ type: "bin", modelKey: mkey, quantity: q.qty, status: "in_house", importSource: q.src }] : [] }] }, ops: [] });
        continue;
      }
      const ops: Op[] = [{ type: "model", key: mkey, categoryPath: catPath, manufacturer: "", name: split.name, variant: split.variant, tracking: "bulk", importSource: q.src }];
      if (q.qty) ops.push({ type: "bin", modelKey: mkey, quantity: q.qty, status: "in_house", importSource: q.src });
      rows.push({ key, sheet: "QLED", src: q.src, bucket: "import", summary: `${catPath.join(" › ")} › ${name}: ${q.qty ?? 0}`, ops });
    }
  }

  const ctl = sheet("LEDController Optælling");
  if (ctl) {
    const mainBoxes = main ? readInventorySheet(main, "main").filter((r) => /^bokse$/i.test(r.category)) : [];
    const weightFor = (re: RegExp) => mainBoxes.find((b) => re.test(b.variant))?.weightKg ?? null;
    rows.push(...controllerRows(readControllers(ctl), ctx, { W6: weightFor(/wieland/i), N6: weightFor(/scroller/i), N4: weightFor(/^4 udgange/i) }));
    if (mainBoxes.length) {
      const counts = readControllers(ctl).reduce((acc: Record<string, number>, c) => ((acc[c.id.split("-")[0]] = (acc[c.id.split("-")[0]] ?? 0) + 1), acc), {});
      const keyFor = (b: InventoryRow) => (/wieland/i.test(b.variant) ? "W6" : /scroller/i.test(b.variant) ? "N6" : "N4");
      rows.push({ key: "ctl:conflict", sheet: "LEDController Optælling", src: "LED - SCROLLER - BOX!F69", bucket: "decision", summary: `Controller counts differ: main sheet ${mainBoxes.map((b) => `${b.variant} = ${b.total?.value}${b.underConstruction ? ` (${b.underConstruction} under construction)` : ""}${b.inRepair ? ` (${b.inRepair} in repair)` : ""}${b.missing ? ` (${b.missing} missing)` : ""}`).join(", ")} vs controller sheet ${Object.entries(counts).map(([k, v]) => `${k} = ${v}`).join(", ")}`, decision: { question: "The controller sheet lists every unit by ID and is used as is. What about the difference?", defaultKey: "controllers", options: [{ key: "controllers", label: "Trust the controller sheet (default)", ops: [] }, { key: "extra", label: "Add the main sheet's surplus as unverified units (main count minus controller count, where positive)", ops: mainBoxes.flatMap((b) => { const n = (b.total?.value ?? 0) - (counts[keyFor(b)] ?? 0); const mk = modelKey("", "BlackLED controller", keyFor(b) === "W6" ? "6 udgange (450w) (Wieland)" : keyFor(b) === "N6" ? "6 udgange (450w) (Scroller)" : "4 udgange (200w)"); return n > 0 ? Array.from({ length: n }, () => ({ type: "unit" as const, modelKey: mk, status: "in_house", notes: "Unverified: counted on the main sheet, not on the controller sheet", importSource: b.totalSrc })) : []; }) }] }, ops: [] });
    }
  }

  const proj = sheet("PROJEKTORE");
  if (proj) rows.push(...projectorRows(readProjectors(proj), ctx));

  const comp = sheet("COMPUTERE");
  if (comp) {
    const c = readComputers(comp);
    const serverKey = modelKey("", "Media server PC (i9 9900K)");
    if (!ctx.existingModels.has(serverKey)) rows.push({ key: "comp:model", sheet: "COMPUTERE", src: "COMPUTERE!B1", bucket: "import", summary: "Video › Media servers › Vertigo Media server PC (i9 9900K)", ops: [{ type: "model", key: serverKey, categoryPath: ["Video", "Media servers"], manufacturer: "", name: "Media server PC (i9 9900K)", tracking: "serialized", notes: "Windows 10 Pro workstation, MadMapper / TouchDesigner", importSource: "COMPUTERE!B1" }] });
    for (const s of c.servers) {
      const day = s.dayPrice !== null && s.discount !== null ? Math.round(s.dayPrice * (1 + s.discount) * 100) / 100 : s.dayPrice;
      rows.push({
        key: `comp:${s.row}`,
        sheet: "COMPUTERE",
        src: s.src,
        bucket: "assumption",
        summary: `Media server › ${s.name}: ${s.cpu}, ${s.ram}, ${s.storage}, ${s.psu}`,
        assumption: `Day price ${day} = components ${s.basePrices.join("+")} / 10${s.discount !== null ? ` with ${Math.abs(s.discount * 100)}% off (H2)` : ""}; purchase ${s.purchaseDate ?? "unknown"}.`,
        ops: serverOps(s, serverKey, day, ctx),
      });
    }
    for (const p of c.parts) {
      const isBox = /BlackBox|Qbox/i.test(p.name);
      const category = isBox ? ["Lighting", "LED controllers"] : /^GPU$/i.test(p.group) ? ["Computers & networking"] : ["Video", "Video signal"];
      const name = p.name.replace(/\s+/g, " ").trim();
      const mkey = modelKey(isBox ? "" : name.split(" ")[0], name);
      const qty = p.qty?.value ?? 1;
      if (isBox) {
        rows.push({ key: `comp:${p.row}`, sheet: "COMPUTERE", src: p.src, bucket: "decision", summary: `${name}: ${qty} — looks like the LED controllers already imported from "LEDController Optælling"`, decision: { question: "Import as a separate bulk model, or skip because the controller sheet already has the units?", defaultKey: "skip", options: [{ key: "skip", label: "Skip (controllers come from the controller sheet)", ops: [] }, { key: "add", label: "Import as a separate bulk model", ops: [{ type: "model", key: mkey, categoryPath: category, manufacturer: "", name, tracking: "bulk", rentalDayPrice: p.dayPrice, importSource: p.src }, { type: "bin", modelKey: mkey, quantity: qty, status: "in_house", importSource: p.src }] }] }, ops: [] });
        continue;
      }
      const ops: Op[] = [];
      if (!ctx.existingModels.has(mkey)) ops.push({ type: "model", key: mkey, categoryPath: category, manufacturer: name.split(" ")[0], name, tracking: "serialized", rentalDayPrice: p.dayPrice, importSource: p.src });
      for (let i = 0; i < qty; i++) ops.push({ type: "unit", modelKey: mkey, status: "in_house", purchasePrice: p.purchasePrice, importSource: p.src });
      const assumption = [p.qty && !p.qty.exact ? `Quantity "${p.qty.raw}" read as ${qty}.` : "", `${qty} serialized unit${qty === 1 ? "" : "s"}${p.purchasePrice ? ` at ${p.purchasePrice} kr` : ""}.`].filter(Boolean).join(" ");
      rows.push({ key: `comp:${p.row}`, sheet: "COMPUTERE", src: p.src, bucket: "assumption", summary: `${category.join(" › ")} › ${name}: ${qty}${p.dayPrice ? ` · day price ${p.dayPrice}` : ""}`, assumption, ops });
    }
    for (const m of c.monitors) {
      const mkey = modelKey(m.name.split(" ")[0], m.name);
      rows.push({ key: `comp:mon:${m.name}`, sheet: "COMPUTERE", src: m.src, bucket: "assumption", summary: `Video › Video signal › ${m.name}${m.weightKg ? ` · ${m.weightKg} kg` : ""}: no quantity`, assumption: "Model created without units.", ops: ctx.existingModels.has(mkey) ? [] : [{ type: "model", key: mkey, categoryPath: ["Video", "Video signal"], manufacturer: m.name.split(" ")[0], name: m.name, tracking: "serialized", weightKg: m.weightKg, importSource: m.src }] });
    }
  }

  const truss = sheet("Truss");
  if (truss) {
    const t = readTruss(truss);
    for (const row of t.inventory) {
      const name = row.description ? `${row.code} ${row.description}` : row.code;
      const mkey = modelKey("Truss (Urs)", name);
      const cf: Record<string, number> = {};
      if (row.lengthM !== null && row.lengthM >= 0.5) cf.length_m = row.lengthM;
      const ops: Op[] = [];
      if (!ctx.existingModels.has(mkey)) ops.push({ type: "model", key: mkey, categoryPath: ["Rigging", "Truss"], manufacturer: "Truss (Urs)", name, tracking: "bulk", rentalDayPrice: row.dayPrice, customFields: Object.keys(cf).length ? cf : undefined, notes: [row.note, row.listPrice ? `List ${row.listPrice} kr, ${row.discountPct ?? 0}% off → ${row.netPrice} kr` : ""].filter(Boolean).join(" · ") || null, importSource: row.src });
      if (row.qty) ops.push({ type: "bin", modelKey: mkey, quantity: row.qty, status: "in_house", importSource: row.src });
      rows.push({ key: `truss:${row.row}`, sheet: "Truss", src: row.src, bucket: "assumption", summary: `Rigging › Truss › ${name}: ${row.qty ?? 0}${row.dayPrice ? ` · day price ${row.dayPrice}` : ""}`, assumption: `Manufacturer unknown on the sheet (supplier Urs); net price ${row.netPrice ?? "?"} kr kept as a note. The order confirmation lists other quantities (see parked rows).`, ops });
    }
    for (const q of t.quotes) rows.push({ key: `truss:quote:${q.row}`, sheet: "Truss", src: `Truss!A${q.row}`, bucket: "parked", summary: q.title, ops: [], parked: { feature: "Purchase records", detail: "Supplier quote with quantities, discounts and powder coating; goes into purchase records when that feature is built (backlog)." } });
    if (t.notes.length) rows.push({ key: "truss:notes", sheet: "Truss", src: "Truss!A51", bucket: "assumption", summary: `Notes: ${t.notes.join(" / ")}`, assumption: "Kept as a note on HD24-200.", ops: [{ type: "modelNote", modelKey: modelKey("Truss (Urs)", "HD24-200"), note: t.notes.join(" / ") }] });
  }

  const stands = sheet("Stativer & Support");
  const standRows = stands ? readInventorySheet(stands, "stands") : [];
  if (stands) rows.push(...inventoryRows(standRows, ctx));

  const rods = sheet("16mm rods");
  if (rods) {
    for (const r of readRods(rods)) {
      const match = standRows.find((s) => low(s.variant).replace(/\s/g, "") === low(r.label).replace(/\s/g, "").replace(/!$/, "") && (/16mm/i.test(r.group) ? /16mm|122B/i.test(s.system) : /28mm/i.test(s.system)));
      const other = match?.total?.value ?? null;
      if (match && other !== null && other !== r.qty) {
        const sp = splitName(match.system, match.variant);
        const mkey = modelKey(manufacturerFor(match.system), sp.name, sp.variant);
        rows.push({ key: `rods:${r.row}`, sheet: "16mm rods", src: r.src, bucket: "decision", summary: `${r.group} ${r.label}: ${r.qty} here vs ${other} on "Stativer & Support"`, decision: { question: "Which count is right?", defaultKey: "stands", options: [{ key: "stands", label: `Keep ${other} (Stativer & Support is newer)`, ops: [] }, { key: "rods", label: `Use ${r.qty} from this sheet instead`, ops: [{ type: "bin", modelKey: mkey, quantity: (r.qty ?? 0) - other, status: "in_house", notes: "Adjusted per 16mm rods sheet", importSource: r.src }] }] }, ops: [] });
      } else if (!match) {
        rows.push({ key: `rods:${r.row}`, sheet: "16mm rods", src: r.src, bucket: "assumption", summary: `${r.group} ${r.label}: ${r.qty} (no matching row on Stativer & Support)`, assumption: "Only the stands sheet is imported; this row is shown for comparison.", ops: [] });
      }
    }
  }

  const loans = sheet("IGANGVÆRENDE UDLEJE");
  if (loans) {
    for (const l of readLoans(loans)) {
      const client = l.title.replace(/^lånt af\s*/i, "").replace(/\s*til kulturhuset.*$/i, "").replace(/\s+\d{1,2}\.\d{1,2}\.\d{2,4}$/, "").trim() || "Unknown";
      const date = l.date ? (/^\d{4}/.test(l.date) ? l.date : l.date.replace(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/, (_m, d, mo, y) => `${y.length === 2 ? "20" + y : y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`)) : "2021-01-01";
      const lines = l.lines.map((ln) => {
        const w = low(ln.what);
        const modelKeyFor = /eclgallery/.test(w) ? modelKey("ETC", "EclGalleryProfile FC 60W RGBW") : /perstrop|th671/.test(w) ? modelKey("BenQ", "BenQ TH671st") : /nec/.test(w) ? modelKey("NEC", "NEC P554U") : /true1/.test(w) && /5m/.test(w) ? modelKey("", "True1", "5 m") : null;
        return { modelKey: modelKeyFor, quantity: ln.qty, text: ln.what };
      });
      rows.push({
        key: `loan:${l.row}`,
        sheet: "IGANGVÆRENDE UDLEJE",
        src: `IGANGVÆRENDE UDLEJE!A${l.row}`,
        bucket: "decision",
        summary: `${l.title}: ${l.lines.length} lines${l.price ? ` · ${l.price}` : ""}`,
        decision: {
          question: "Is this loan still open?",
          defaultKey: "open",
          options: [
            { key: "open", label: "Yes: create it as an overdue rental (lines matched where possible, the rest in the notes)", ops: [{ type: "contact", name: client, kind: "person", importSource: `IGANGVÆRENDE UDLEJE!A${l.row}` }, { type: "rental", clientName: client, startDate: date, endDate: date, notes: `Imported loan. Lines: ${l.lines.map((x) => `${x.qty}× ${x.what}`).join("; ")}${l.price ? `. Price: ${l.price}` : ""}`, lines, importSource: `IGANGVÆRENDE UDLEJE!A${l.row}` }] },
            { key: "closed", label: "No, it was returned: skip", ops: [] },
          ],
        },
        ops: [],
      });
    }
  }

  const fobs = sheet("Nøglebrikker");
  if (fobs) {
    const f = readFobs(fobs);
    const mkey = modelKey("", "Key fob");
    if (!ctx.existingModels.has(mkey)) rows.push({ key: "fob:model", sheet: "Nøglebrikker", src: "Nøglebrikker!A4", bucket: "import", summary: `Keys & access › Key fobs › Key fob: ${f.fobs.length} serialized`, ops: [{ type: "model", key: mkey, categoryPath: ["Keys & access", "Key fobs"], manufacturer: "", name: "Key fob", tracking: "serialized", notes: f.notes.join(" · ") || null, importSource: "Nøglebrikker!A4" }] });
    for (const fob of f.fobs) {
      if (ctx.existingTags.has(fob.id)) {
        rows.push({ key: `fob:${fob.row}`, sheet: "Nøglebrikker", src: fob.src, bucket: "decision", summary: `${fob.id}: asset tag already exists`, decision: { question: "Already in the inventory.", defaultKey: "skip", options: [{ key: "skip", label: "Skip", ops: [] }] }, ops: [] });
        continue;
      }
      const unit: UnitOp = { type: "unit", modelKey: mkey, assetTag: fob.id, status: "in_house", notes: fob.group, importSource: fob.src };
      const ops: Op[] = [];
      let assumption: string | undefined;
      if (fob.holder && /^mangler$/i.test(fob.holder)) {
        unit.status = "missing";
        unit.conditionNotes = "MANGLER";
        assumption = "MANGLER → missing.";
      } else if (fob.holder) {
        const user = ctx.users.find((u) => low(u.name).split(" ")[0] === low(fob.holder!).split(" ")[0]);
        if (user) {
          ops.push({ type: "location", name: user.name, kind: "person", importSource: fob.src });
          unit.personName = user.name;
          assumption = `Holder "${fob.holder}" matched to user ${user.name}.`;
        } else {
          ops.push({ type: "contact", name: fob.holder, kind: /^bil$/i.test(fob.holder) ? "company" : "person", notes: /^bil$/i.test(fob.holder) ? "The car" : undefined, importSource: fob.src });
          ops.push({ type: "location", name: fob.holder, kind: "person", contactName: fob.holder, importSource: fob.src });
          unit.personName = fob.holder;
          assumption = `Holder "${fob.holder}" is not a user: contact + person location created.`;
        }
      }
      ops.push(unit);
      rows.push({ key: `fob:${fob.row}`, sheet: "Nøglebrikker", src: fob.src, bucket: assumption ? "assumption" : "import", summary: `Key fob ${fob.id} (${fob.group})${fob.holder ? ` · ${fob.holder}` : " · unassigned"}`, assumption, ops });
    }
  }

  const rates = sheet("lejefaktor");
  if (rates) {
    // "+10% of the day-1 price per further day" / "+0.5 per 10 days": the rule beyond the last tier, by table.
    const RULES: Record<string, { extraRule: "per_day" | "per_10_days"; extraFactor: number; why: string }> = {
      Standard: { extraRule: "per_day", extraFactor: 0.1, why: '"efterfølgende dage +10% af 1. dags leje" read as +0.1 per further day' },
      Theatre: { extraRule: "per_10_days", extraFactor: 0.5, why: '"10 dage = + 0.5 Faktor" read as +0.5 per started 10 days; the 1-day factor 0.5 is a base, not for single days' },
      Revised: { extraRule: "per_10_days", extraFactor: 0.5, why: "the J/K column continues +0.5 per 10 days; the second copy's 3.4 at 30 days is not used" },
    };
    for (const t of readRateTables(rates)) {
      const rule = RULES[t.name];
      const tiers = t.tiers.filter((x, i, arr) => arr.findIndex((y) => y.days === x.days) === i);
      rows.push({
        key: `rate:${t.name}`,
        sheet: "lejefaktor",
        src: "lejefaktor!A1",
        bucket: "assumption",
        summary: `Rate table "${t.name}": ${tiers.map((x) => `${x.days}d=${x.factor}`).join(", ")}`,
        assumption: `${rule ? rule.why : "no rule beyond the last tier"}. Skipped if a table with this name exists.`,
        ops: [{ type: "rateTable", name: t.name, isDefault: t.name === "Standard", extraRule: rule?.extraRule ?? "none", extraFactor: rule?.extraFactor ?? 0, notes: t.rules.length ? t.rules.join("; ") : null, tiers, importSource: "lejefaktor!A1" }],
      });
    }
  }
  const div = sheet("Dirverse");
  if (div) rows.push({ key: "div:tente", sheet: "Dirverse", src: "Dirverse!A8", bucket: "parked", summary: "TENTE castor reference (Alpha 3477UFR100P62 100 mm, 3477UFR125P62 125 mm)", ops: [], parked: { feature: "Wish list / reference", detail: "Reference material, not inventory; goes into the wish list when that feature is built (backlog)." } });

  const counts: Record<Bucket, number> = { import: 0, assumption: 0, decision: 0, parked: 0 };
  for (const r of rows) counts[r.bucket]++;
  return { rows, counts, fileName: wb.fileName };
}

/** The operations a plan will perform given the decisions made (key → option key). */
export function resolveOps(plan: Plan, decisions: Record<string, string>): Op[] {
  const ops: Op[] = [];
  for (const r of plan.rows) {
    if (r.bucket === "parked") continue;
    if (r.decision) {
      const choice = decisions[r.key] ?? r.decision.defaultKey;
      const opt = r.decision.options.find((o) => o.key === choice) ?? r.decision.options.find((o) => o.key === r.decision!.defaultKey);
      if (opt) ops.push(...opt.ops);
      continue;
    }
    ops.push(...r.ops);
  }
  return ops;
}
