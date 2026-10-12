import ExcelJS from "exceljs";

/**
 * Reads the Vertigo gear spreadsheet (`Vertigo Gearliste _ Status.xlsx`)
 * into plain rows. This file knows the sheet layouts and the Danish
 * column names; it does not touch the database. Every value keeps the
 * cell it came from, so the preview and the imported rows can point back
 * ("PROJEKTORE!B23").
 */

export type Src = string; // "Sheet!A1"

export type Cell = { v: string; src: Src };

/** A sheet as a sparse grid of trimmed strings, 1-based rows and A-based columns. */
export type Grid = {
  name: string;
  rows: Map<number, Map<string, Cell>>;
  rowNumbers: number[];
};

export type Workbook = { sheets: Map<string, Grid>; fileName: string };

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const v = value as { richText?: { text: string }[]; result?: unknown; text?: string; hyperlink?: string; formula?: string; sharedFormula?: string };
    if (v.richText) return v.richText.map((t) => t.text).join("").trim();
    if (v.result !== undefined && v.result !== null) return cellText(v.result as ExcelJS.CellValue);
    if (v.text !== undefined) return String(v.text).trim();
    if (v.hyperlink) return String(v.hyperlink).trim();
    return ""; // formula without a cached result
  }
  return String(value).trim();
}

export async function readWorkbook(bytes: Buffer, fileName = "workbook.xlsx"): Promise<Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  const sheets = new Map<string, Grid>();
  for (const ws of wb.worksheets) {
    const rows = new Map<number, Map<string, Cell>>();
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      const cols = new Map<string, Cell>();
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cellText(cell.value);
        if (v !== "") cols.set(cell.address.replace(/\d+$/, ""), { v, src: `${ws.name}!${cell.address}` });
      });
      if (cols.size > 0) rows.set(r, cols);
    });
    sheets.set(ws.name, { name: ws.name, rows, rowNumbers: [...rows.keys()].sort((a, b) => a - b) });
  }
  return { sheets, fileName };
}

export function get(g: Grid, r: number, col: string): Cell | undefined {
  return g.rows.get(r)?.get(col);
}
export function text(g: Grid, r: number, col: string): string {
  return get(g, r, col)?.v ?? "";
}
export function src(g: Grid, r: number, col: string): Src {
  return `${g.name}!${col}${r}`;
}

/* Parsing helpers ------------------------------------------------------- */

export type Qty = { value: number; exact: boolean; raw: string };

/** "12" → 12; "19(old)+ 9 (new)" → 28 (inexact); "mindst 8" → 8 (inexact); "har 4 stk (3 stk)" → 4 (inexact). */
export function parseQuantity(raw: string): Qty | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return { value: Number(s), exact: true, raw };
  const nums = s.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0) return null;
  if (/\+/.test(s) && nums.length > 1) return { value: nums.reduce((a, b) => a + b, 0), exact: false, raw };
  return { value: nums[0], exact: false, raw };
}

/** "~0.8 kg", "2 kg ", "6,4kg -kasse" → kilograms. */
export function parseWeightKg(raw: string): number | null {
  const m = raw.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*kg/i);
  return m ? Number(m[1]) : null;
}

/** "[5 A pr. fixtur]" → watts at 230 V. */
export function parseAmpsToWatts(raw: string): number | null {
  const m = raw.match(/\[(\d+(?:[.,]\d+)?)\s*A/i);
  return m ? Math.round(Number(m[1].replace(",", ".")) * 230) : null;
}

/** "3500 Lumen" → 3500. */
export function parseLumen(raw: string): number | null {
  const m = raw.match(/(\d{3,6})/);
  return m ? Number(m[1]) : null;
}

/** "1,5 m. (tynd)" → { length: "1,5 m", variant: "tynd" }; keeps the label readable. */
export function parseVariant(raw: string): { label: string; note: string | null } {
  const notes = [...raw.matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim()).filter(Boolean);
  const note = notes.length ? notes.join(", ") : null;
  const label = raw
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*\.$/, "")
    .trim();
  return { label: label || raw.trim(), note };
}

/** Plain decimal ("0.105", "1,5") without thousand-separator guessing. */
export function parseDecimal(raw: string): number | null {
  const m = raw.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function parseMoney(raw: string): number | null {
  const s = raw.replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** "Udlån" cells: "ukirke" + "2" → { name: "ukirke", qty: 2 }; "? !! kan ikke findes" → missing. */
export function parseLoan(name: string, qty: string): { kind: "loan"; name: string; qty: number } | { kind: "missing"; qty: number; raw: string } | null {
  const n = name.trim();
  if (!n) return null;
  const q = parseQuantity(qty)?.value ?? 1;
  if (/kan ikke findes|\?/i.test(n)) return { kind: "missing", qty: q, raw: n };
  return { kind: "loan", name: n, qty: q };
}

/* Sheet readers --------------------------------------------------------- */

export type InventoryRow = {
  sheet: string;
  row: number;
  category: string; // from column A, carried down
  system: string; // from column B, carried down
  systemSrc: Src;
  variant: string; // column C
  variantSrc: Src;
  price: number | null;
  weightKg: number | null;
  weightRaw: string;
  total: Qty | null;
  totalSrc: Src;
  minusRepMissing: string;
  loan: ReturnType<typeof parseLoan>;
  inRepair: number;
  missing: number;
  underConstruction: number;
  note: string;
  extras: string[]; // any other cells on the row, for the preview
  powerW: number | null;
};

const MAIN_COLS = { A: "category", B: "system", C: "variant", D: "price", E: "weight", F: "total", G: "minus", H: "loanName", I: "loanQty", J: "repair", K: "missing", L: "construction", M: "note" } as const;
const STAND_COLS = { A: "category", B: "system", C: "variant", D: "weight", E: "total", F: "minus", G: "loanName", H: "loanQty", I: "repair", J: "missing", K: "construction", L: "note" } as const;

/**
 * The "Hvad | Type | Str. | ..." sheets: category in A and system in B carry
 * down over blank cells; a row counts when it has a quantity or a variant.
 */
/** "50cm", "76 x 76 mm", "2.0 m", "150cm med forlænger": a size, not a system name. */
const SIZE_LIKE = /^(\d+([.,]\d+)?\s*(cm|mm|m)\.?(\s+(med|m\.)\s+forlænger)?\s*!?|\d+\s*x\s*\d+\s*(mm|cm))$/i;
const AMP_SPEC = /^\[.*A pr\./i;

export function readInventorySheet(g: Grid, layout: "main" | "stands"): InventoryRow[] {
  const cols = layout === "main" ? MAIN_COLS : STAND_COLS;
  const col = (key: string) => (Object.entries(cols).find(([, v]) => v === key)?.[0] ?? "") as string;
  const out: InventoryRow[] = [];
  let category = "";
  let system = "";
  let systemSrc = "";
  let aluBase = "";
  let meloInventory = false;
  for (const r of g.rowNumbers) {
    if (r <= 3) continue; // title + headers
    const aRaw = text(g, r, col("category"));
    let a = aRaw;
    let b = text(g, r, col("system"));
    let c = text(g, r, col("variant"));
    const totalRaw = text(g, r, col("total"));
    const weightRaw = text(g, r, col("weight"));
    const priceRaw = layout === "main" ? text(g, r, "D") : "";
    if (a && !b && !c && !totalRaw) {
      category = a;
      system = "";
      aluBase = "";
      meloInventory = false;
      continue;
    }
    // MELO III: only the "what we have" table (after the "højder på podier" header) is inventory.
    if (/MELO/i.test(category)) {
      if (/højder på podier/i.test(c)) {
        meloInventory = true;
        continue;
      }
      if (!meloInventory || !/^\d+\s*cm/i.test(b) || !/^\d+$/.test(c)) continue;
      system = "MELO III podium legs 40×40";
      systemSrc = src(g, r, col("system"));
      c = b.replace(/\s*ben$/i, "");
      b = "";
    }
    // "LASER spejle | 76 x 76 mm | Mirror 4-6 Wave": A names the system, B is the size.
    if (a && a !== category && b && SIZE_LIKE.test(b)) {
      system = a;
      systemSrc = src(g, r, col("category"));
      c = [b, c].filter(Boolean).join(" · ");
      b = "";
      a = "";
    }
    const extraNotes: string[] = [];
    if (b && AMP_SPEC.test(b)) {
      extraNotes.push(b); // "[5 A pr. fixtur]" is a power spec on a SplitLED row, not a system
      b = "";
    } else if (b && SIZE_LIKE.test(b) && system) {
      c = [b, c].filter(Boolean).join(" · "); // "50cm" under a PentaLED / rods header, "400 x 300 mm · Mirror"
      b = "";
    }
    if (/^Alu$/i.test(category) && b && !/hjørner/i.test(b)) {
      // Comments in B ("til HESS soft box", "WKB 2026") belong to the row, not a new model;
      // the profile itself was named by the section header.
      if (!aluBase && !c) aluBase = b;
      else if (c) {
        extraNotes.push(b);
        b = "";
        system = aluBase || system;
      }
    }
    if (b && !/^\d+$/.test(b)) {
      system = b;
      systemSrc = src(g, r, col("system"));
      if (!c && !totalRaw && !weightRaw && !priceRaw) continue; // a system header line
    }
    if (!c && !totalRaw && !b) continue;
    if (/^i alt$/i.test(c)) continue;
    if (!totalRaw && !weightRaw && !priceRaw) continue; // nothing countable or describable on this line
    const total = parseQuantity(totalRaw);
    const extras: string[] = [];
    for (const [k, cell] of g.rows.get(r) ?? []) {
      if (!(k in cols)) extras.push(`${k}: ${cell.v}`);
    }
    const sysLabel = b && /^\d+$/.test(b) ? system : system;
    out.push({
      sheet: g.name,
      row: r,
      category,
      system: sysLabel,
      systemSrc,
      variant: c,
      variantSrc: src(g, r, col("variant")),
      price: layout === "main" ? parseMoney(text(g, r, "D")) : null,
      weightKg: parseWeightKg(text(g, r, col("weight"))),
      weightRaw: text(g, r, col("weight")),
      total,
      totalSrc: src(g, r, col("total")),
      minusRepMissing: text(g, r, col("minus")),
      loan: /MELO/i.test(category) ? null : parseLoan(text(g, r, col("loanName")), text(g, r, col("loanQty"))),
      inRepair: parseQuantity(text(g, r, col("repair")))?.value ?? 0,
      missing: parseQuantity(text(g, r, col("missing")))?.value ?? 0,
      underConstruction: parseQuantity(text(g, r, col("construction")))?.value ?? 0,
      note: [text(g, r, col("note")), ...extraNotes, b && /^\d+$/.test(b) ? `B: ${b}` : "", a && (b || c || totalRaw) && a !== category ? `A: ${a}` : ""].filter(Boolean).join(" · "),
      extras,
      powerW: parseAmpsToWatts(extraNotes.join(" ")) ?? parseAmpsToWatts(system),
    });
  }
  return out;
}

export type ControllerRow = { row: number; id: string; idSrc: Src; ip: string; board: string; status: string; firmware: string; correctedId: string | null };

export function readControllers(g: Grid): ControllerRow[] {
  const out: ControllerRow[] = [];
  for (const r of g.rowNumbers) {
    const id = text(g, r, "B");
    if (!/^[A-Z]\d-\d+$/.test(id)) continue;
    const m = text(g, r, "M").match(/ID:\s*([A-Z]\d-\d+)/);
    out.push({ row: r, id, idSrc: src(g, r, "B"), ip: text(g, r, "C").replace(/[^\d.]/g, ""), board: text(g, r, "D"), status: text(g, r, "E"), firmware: text(g, r, "F"), correctedId: m ? m[1] : null });
  }
  return out;
}

export type ProjectorRow = {
  row: number;
  id: string | null;
  idSrc: Src;
  model: string;
  modelSrc: Src;
  lumen: number | null;
  throwRatio: string;
  lensShift: string;
  resolution: string;
  dayPrice: number | null;
  notForRental: boolean;
  notes: string[];
  serial: string | null;
  location: string | null;
  section: "own" | "gearguys" | "wish";
};

export function readProjectors(g: Grid): ProjectorRow[] {
  const out: ProjectorRow[] = [];
  let section: ProjectorRow["section"] = "own";
  for (const r of g.rowNumbers) {
    const a = text(g, r, "A");
    const b = text(g, r, "B");
    if (/^GearGuys/i.test(a)) section = "gearguys";
    if (/^Ønsker/i.test(b) || /^Ønsker/i.test(a)) section = "wish";
    if (/^Ex\. projektore/i.test(a)) section = "own";
    if (r <= 5 || !b || /^Ønsker/i.test(b)) continue;
    if (/^ID$/i.test(a)) continue;
    const g7 = text(g, r, "G");
    const notes = ["H", "I", "J", "K", "L"].map((c) => text(g, r, c)).filter(Boolean);
    const serialCell = text(g, r, "J");
    const serial = /^[A-Z0-9]{10,}$/.test(serialCell) ? serialCell : null;
    out.push({
      row: r,
      id: /^[A-Z]{1,2}\d{1,2}$/.test(a) ? a : null,
      idSrc: src(g, r, "A"),
      model: b.replace(/<[^>]*>/g, "").trim(),
      modelSrc: src(g, r, "B"),
      lumen: parseLumen(text(g, r, "C")),
      throwRatio: text(g, r, "D"),
      lensShift: text(g, r, "E"),
      resolution: text(g, r, "F"),
      dayPrice: /ikke til udleje/i.test(g7) ? null : parseMoney(g7),
      notForRental: /ikke til udleje/i.test(g7),
      notes: serial ? notes.filter((n) => n !== serialCell) : notes,
      serial,
      location: /bremen/i.test(text(g, r, "I")) ? "Bremen" : null,
      section,
    });
  }
  return out;
}

export type ComputerRow = { row: number; name: string; src: Src; qty: Qty | null; purchasePrice: number | null; dayPrice: number | null; group: string };
export type MediaServerRow = { row: number; name: string; src: Src; cpu: string; storage: string; ram: string; psu: string; purchaseDate: string | null; basePrices: number[]; dayPrice: number | null; discount: number | null; notes: string[] };

export function readComputers(g: Grid): { servers: MediaServerRow[]; parts: ComputerRow[]; monitors: { name: string; weightKg: number | null; src: Src }[] } {
  const servers: MediaServerRow[] = [];
  const parts: ComputerRow[] = [];
  const monitors: { name: string; weightKg: number | null; src: Src }[] = [];
  const discount = parseMoney(text(g, 2, "H"));
  let group = "";
  for (const r of g.rowNumbers) {
    const a = text(g, r, "A");
    const b = text(g, r, "B");
    if (/^(GPU|PCIe cards|Outboard Gear)$/i.test(b) && !text(g, r, "D")) {
      group = b;
      continue;
    }
    if (/^Skærme$/i.test(a)) {
      group = "Skærme";
      continue;
    }
    if (a && /baseprice/i.test(a)) {
      const s = servers[servers.length - 1];
      if (s) {
        s.basePrices = ["B", "C", "D", "E", "F"].map((c) => parseMoney(text(g, r, c)) ?? 0);
        s.dayPrice = parseMoney(text(g, r, "G"));
        s.discount = discount;
      }
      continue;
    }
    if (a && /^(Pink|Green)\s/i.test(a)) {
      servers.push({ row: r, name: a, src: src(g, r, "A"), cpu: text(g, r, "C"), storage: text(g, r, "D"), ram: text(g, r, "E"), psu: text(g, r, "F"), purchaseDate: text(g, r, "H") || null, basePrices: [], dayPrice: null, discount: null, notes: [b, text(g, r, "K")].filter(Boolean) });
      continue;
    }
    if (group === "Skærme" && a) {
      monitors.push({ name: a, weightKg: parseWeightKg(text(g, r, "C")), src: src(g, r, "A") });
      continue;
    }
    if (group && b && r > 2) {
      parts.push({ row: r, name: b, src: src(g, r, "B"), qty: parseQuantity(text(g, r, "D")), purchasePrice: parseMoney(text(g, r, "E")), dayPrice: parseMoney(text(g, r, "G")), group });
    }
  }
  return { servers, parts, monitors };
}

export type TrussRow = { row: number; code: string; src: Src; description: string | null; lengthM: number | null; qty: number | null; dayPrice: number | null; listPrice: number | null; discountPct: number | null; netPrice: number | null; note: string | null };

/** Rows 4–39: inventory + pricing; the quotes below row 55 are parked (purchase records). */
export function readTruss(g: Grid): { inventory: TrussRow[]; quotes: { title: string; row: number }[]; notes: string[] } {
  const inventory: TrussRow[] = [];
  const quotes: { title: string; row: number }[] = [];
  const notes: string[] = [];
  let quoteSection = false;
  for (const r of g.rowNumbers) {
    const a = text(g, r, "A");
    if (/tilbud|ordrebekr/i.test(a)) {
      quoteSection = true;
      quotes.push({ title: a, row: r });
      continue;
    }
    if (/^noter/i.test(a)) {
      notes.push([text(g, r, "B"), text(g, r + 1, "B")].filter(Boolean).join(" / "));
      continue;
    }
    if (quoteSection || r < 4 || !a) continue;
    const qty = parseQuantity(text(g, r, "C"));
    if (!qty && !text(g, r, "H")) {
      // description line under a code
      const last = inventory[inventory.length - 1];
      if (last && !last.description) last.description = a;
      else if (last) last.note = [last.note, a].filter(Boolean).join(" · ");
      continue;
    }
    inventory.push({
      row: r,
      code: a,
      src: src(g, r, "A"),
      description: null,
      lengthM: parseDecimal(text(g, r, "B")),
      qty: qty?.value ?? null,
      dayPrice: parseMoney(text(g, r, "F")),
      listPrice: parseMoney(text(g, r, "H")),
      discountPct: parseMoney(text(g, r, "I")),
      netPrice: parseMoney(text(g, r, "K")),
      note: text(g, r, "D") || null,
    });
  }
  return { inventory, quotes, notes };
}

export type RodsRow = { row: number; label: string; src: Src; qty: number | null; group: string };

/** "16mm rods": label in A, count in D, groups introduced by a heading row without a count. */
export function readRods(g: Grid): RodsRow[] {
  const out: RodsRow[] = [];
  let group = "";
  for (const r of g.rowNumbers) {
    const a = text(g, r, "A");
    const d = text(g, r, "D");
    if (!a) continue;
    if (!d) {
      group = a + (text(g, r, "B") ? ` ${text(g, r, "B")}` : "");
      continue;
    }
    out.push({ row: r, label: a, src: src(g, r, "A"), qty: parseQuantity(d)?.value ?? null, group });
  }
  return out;
}

export type FobRow = { row: number; id: string; src: Src; holder: string | null; group: string };

export function readFobs(g: Grid): { fobs: FobRow[]; notes: string[] } {
  const fobs: FobRow[] = [];
  const notes: string[] = [];
  let group = "";
  for (const r of g.rowNumbers) {
    const a = text(g, r, "A");
    const b = text(g, r, "B");
    if (/^U\d{5}$/.test(a)) fobs.push({ row: r, id: a, src: src(g, r, "A"), holder: b || null, group });
    else if (a) group = a;
    else if (b) notes.push(b);
  }
  return { fobs, notes };
}

export type LoanRow = { row: number; qty: number; what: string; src: Src };
export type Loan = { title: string; row: number; date: string | null; lines: LoanRow[]; price: string | null };

/** Two free-text loans: a title line, then "4 x ..." lines, then a price. */
export function readLoans(g: Grid): Loan[] {
  const loans: Loan[] = [];
  for (const r of g.rowNumbers) {
    const a = text(g, r, "A");
    const b = text(g, r, "B");
    if (!a && !b) continue;
    const isTitle = /lånt|låner|udlånt/i.test(a) || (/^\d{4}-\d{2}-\d{2}$/.test(b) && !/^\d/.test(a));
    if (isTitle) {
      loans.push({ title: a, row: r, date: /^\d{4}-\d{2}-\d{2}$/.test(b) ? b : (a.match(/(\d{1,2}\.\d{1,2}\.\d{2,4})/)?.[1] ?? null), lines: [], price: null });
      continue;
    }
    const cur = loans[loans.length - 1];
    if (!cur) continue;
    if (/\d+\s*,-|moms/i.test(a)) {
      cur.price = a;
      continue;
    }
    const line = a.match(/^(\d+)\s*(?:x|stk)\.?\s*(.*)$/i);
    const what = (line ? line[2] : a).trim() || b;
    if (!what) continue;
    cur.lines.push({ row: r, qty: line ? Number(line[1]) : 1, what, src: src(g, r, "A") });
  }
  return loans;
}

export type QledRow = { row: number; system: string; variant: string; qty: number | null; src: Src; section: "old" | "new" | "accessories" };

export function readQled(g: Grid): QledRow[] {
  const out: QledRow[] = [];
  let section: QledRow["section"] = "old";
  let system = "";
  for (const r of g.rowNumbers) {
    const a = text(g, r, "A");
    const b = text(g, r, "B");
    const c = text(g, r, "C");
    const f = text(g, r, "F");
    if (/Ny op/i.test(a)) {
      section = "new";
      continue;
    }
    if (/^Accesories/i.test(a)) {
      section = "accessories";
      continue;
    }
    if (/^Grupper$/i.test(b)) break;
    if (r <= 2) continue;
    if (b && !f) {
      system = b;
      continue;
    }
    if (!f) continue;
    out.push({ row: r, system: section === "accessories" ? b : system, variant: c, qty: parseQuantity(f)?.value ?? null, src: src(g, r, "F"), section });
  }
  return out;
}

export type RateTier = { days: number; factor: number };

/** The three rate tables, for the preview only (the pricing engine is backlog). */
export function readRateTables(g: Grid): { name: string; tiers: RateTier[]; rules: string[] }[] {
  const num = (s: string) => Number(s.replace(",", "."));
  const standard: RateTier[] = [];
  const theatre: RateTier[] = [];
  const revised: RateTier[] = [];
  const rules: string[] = [];
  for (const r of g.rowNumbers) {
    const a = text(g, r, "A");
    const b = text(g, r, "B");
    const e = text(g, r, "E");
    const f = text(g, r, "F");
    const j = text(g, r, "J");
    const k = text(g, r, "K");
    const days = a.match(/^(\d+)(?:-\d+)?\s*dag/i);
    if (days && b && r < 20) standard.push({ days: Number(days[1]), factor: num(b) });
    const tdays = e.match(/^(\d+)\s*dag/i);
    if (tdays && f) theatre.push({ days: Number(tdays[1]), factor: num(f) });
    if (/6 md/i.test(e) && f) theatre.push({ days: 180, factor: num(f) });
    if (/^\d+$/.test(j) && k && num(k) > 0) revised.push({ days: Number(j), factor: num(k) });
    if (/efterfølgende|\+ ?0\.5|excl\. moms/i.test(a) || /efterfølgende|\+ ?0\.5/i.test(e)) rules.push(a || e);
  }
  return [
    { name: "Standard", tiers: standard, rules: rules.filter((x) => /efterfølgende|excl/i.test(x)) },
    { name: "Theatre", tiers: theatre, rules: rules.filter((x) => /\+ ?0\.5|10 dage/i.test(x)) },
    { name: "Revised", tiers: revised, rules: ["+0.5 per 10 days after 30"] },
  ];
}
