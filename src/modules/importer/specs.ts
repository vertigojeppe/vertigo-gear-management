// eslint-disable-next-line no-restricted-imports -- pure helper; the barrel pulls server actions (next-auth) into Vitest
import { parseLinksText } from "@/modules/inventory/schema";

/**
 * Spec sheet import (pure): a CSV with one row per model, keyed by the
 * model id from the models export, that fills in weight, dimensions,
 * power, description, links and extra fields. Any other column whose name
 * matches an extra field of the model's category (its label or its key,
 * ignoring case, spaces and punctuation: "Lumen", "Throw ratio") fills
 * that field, whatever key it was given. Only empty fields start ticked;
 * a value already on the model is kept unless ticked. Links are added
 * when their URL is new.
 */

export type Link = { label: string; url: string };

export const SPEC_NUMBERS = [
  { field: "weightKg", header: "Weight (kg)", integer: false },
  { field: "widthCm", header: "Width (cm)", integer: false },
  { field: "heightCm", header: "Height (cm)", integer: false },
  { field: "depthCm", header: "Depth (cm)", integer: false },
  { field: "powerDrawW", header: "Power (W)", integer: true },
] as const;
export type SpecNumberField = (typeof SPEC_NUMBERS)[number]["field"];

/** Columns of the models export and the review sheet that are not extra fields. */
const NOT_EXTRA = ["id", "manufacturer", "model", "variant", "product", "category", "tracking", "in house", "owned", "day price", "not for rental", "archived", "notes", "specs checked", "description", "links", "confidence", "sources", ...SPEC_NUMBERS.map((s) => s.header)].map((h) => squashHeader(h));

/** Columns that are extra fields even where no category has them yet, so the preview says they were skipped. */
const KNOWN_EXTRA = ["lumen", "throwratio"];

/** "Throw ratio", "throw_ratio" and "THROW-RATIO" are the same column. */
export function squashHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9æøå]/g, "");
}

export type SpecRow = {
  line: number;
  id: string;
  numbers: Partial<Record<SpecNumberField, number>>;
  /** Other non-empty columns, by header as written: candidates for extra fields. */
  extra: Record<string, string>;
  description?: string;
  links: Link[];
};

export type SpecSheet = { rows: SpecRow[]; errors: string[] };

/** Bytes from a file: UTF-8 (with or without BOM), else Windows-1252, which is what Excel's plain "CSV" saves on Danish Windows. */
export function decodeSheet(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** CSV with quotes and line breaks inside quoted cells; the separator (";" or ",") is read from the header line. */
export function parseDelimited(text: string): string[][] {
  const src = text.replace(/\r\n?/g, "\n");
  const header = src.slice(0, src.indexOf("\n") === -1 ? undefined : src.indexOf("\n"));
  const sep = (header.match(/;/g)?.length ?? 0) >= (header.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (src[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** "32,5" and "32.5" are both 32.5; whole numbers may carry thousands separators ("3.500", "3 500"). */
export function parseSpecNumber(raw: string, integer: boolean): number | null {
  let s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  if (integer && /^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
  s = s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  const n = Number(s);
  return integer && !Number.isInteger(n) ? NaN : n;
}

export function readSpecSheet(text: string): SpecSheet {
  const [header, ...body] = parseDelimited(text);
  if (!header) return { rows: [], errors: ["The file is empty."] };
  const col = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]));
  const idCol = col.get("id");
  if (idCol === undefined) return { rows: [], errors: ['The sheet needs an "Id" column (the models export has one).'] };
  const get = (r: string[], h: string) => {
    const i = col.get(h.toLowerCase());
    return i === undefined ? "" : (r[i] ?? "").trim();
  };
  const rows: SpecRow[] = [];
  const errors: string[] = [];
  body.forEach((r, n) => {
    const line = n + 2;
    const id = (r[idCol] ?? "").trim();
    if (!id) return;
    const row: SpecRow = { line, id, numbers: {}, extra: {}, links: [] };
    for (const s of SPEC_NUMBERS) {
      const v = parseSpecNumber(get(r, s.header), s.integer);
      if (v === null) continue;
      if (Number.isNaN(v)) errors.push(`Row ${line}: "${get(r, s.header)}" in ${s.header} is not a ${s.integer ? "whole " : ""}number.`);
      else row.numbers[s.field] = v;
    }
    header.forEach((h, i) => {
      const raw = (r[i] ?? "").trim();
      if (raw && h.trim() && !NOT_EXTRA.includes(squashHeader(h))) row.extra[h.trim()] = raw;
    });
    const description = get(r, "Description");
    if (description) row.description = description;
    row.links = parseLinksText(get(r, "Links"));
    rows.push(row);
  });
  return { rows, errors };
}

export type CurrentModel = {
  id: string;
  label: string;
  numbers: Record<SpecNumberField, number | null>;
  description: string | null;
  links: Link[];
  customFields: Record<string, unknown>;
  /** The extra fields that apply to the model's category. */
  defs: { key: string; label: string; type: string }[];
};

/** fill: written; keep: the model already has a different value, which stays; same: already there; unavailable: no such extra field for the model's category. */
export type ChangeAction = "fill" | "keep" | "same" | "unavailable";
/** `field`: a model column, or an extra field's key (then `label` names it and `value` is what gets written). */
export type SpecChange = { field: string; from: string | null; to: string; action: ChangeAction; label?: string; value?: unknown };
export type ModelSpecPlan = { id: string; label: string; changes: SpecChange[] };
export type SpecPlan = { models: ModelSpecPlan[]; unknownIds: { line: number; id: string }[]; errors: string[] };

const blank = (v: unknown) => v === null || v === undefined || v === "";
const show = (v: unknown) => (blank(v) ? null : String(v));

const matches = (def: { key: string; label: string }, header: string) => squashHeader(def.label) === squashHeader(header) || squashHeader(def.key) === squashHeader(header);

/** A sheet value read the way the field stores it; NaN for a number that is not one. */
function extraValue(type: string, raw: string): unknown {
  // "3.500" is three thousand five hundred (Danish Excel), "0,49" and "1.5" are decimals.
  if (type === "number") {
    const whole = parseSpecNumber(raw, true);
    return whole !== null && !Number.isNaN(whole) ? whole : parseSpecNumber(raw, false);
  }
  if (type === "checkbox") return /^(1|x|yes|ja|true|✓)$/i.test(raw.trim());
  return raw;
}

export function planSpecs(sheet: SpecSheet, current: Map<string, CurrentModel>): SpecPlan {
  const models: ModelSpecPlan[] = [];
  const unknownIds: { line: number; id: string }[] = [];
  const errors = [...sheet.errors];
  // A column counts as an extra field when some model in the sheet has a field by that name (or it is a well-known one).
  const allDefs = [...current.values()].flatMap((m) => m.defs);
  const isExtra = (header: string) => KNOWN_EXTRA.includes(squashHeader(header)) || allDefs.some((d) => matches(d, header));
  for (const row of sheet.rows) {
    const m = current.get(row.id);
    if (!m) {
      unknownIds.push({ line: row.line, id: row.id });
      continue;
    }
    const changes: SpecChange[] = [];
    const compare = (field: string, now: unknown, to: string | number, same: boolean) =>
      changes.push({ field, from: show(now), to: String(to), action: blank(now) ? "fill" : same ? "same" : "keep" });
    for (const s of SPEC_NUMBERS) {
      const to = row.numbers[s.field];
      if (to === undefined) continue;
      const now = m.numbers[s.field];
      compare(s.field, now, to, now !== null && Math.abs(now - to) < 0.05);
    }
    for (const [header, raw] of Object.entries(row.extra)) {
      if (!isExtra(header)) continue;
      const def = m.defs.find((d) => matches(d, header));
      if (!def) {
        changes.push({ field: header, label: header, from: null, to: raw, action: "unavailable" });
        continue;
      }
      const value = extraValue(def.type, raw);
      if (typeof value === "number" && Number.isNaN(value)) {
        errors.push(`Row ${row.line}: "${raw}" in ${header} is not a number.`);
        continue;
      }
      const now = m.customFields[def.key];
      const same = typeof value === "number" ? Number(now) === value : String(now ?? "").trim().toLowerCase() === String(value).trim().toLowerCase();
      changes.push({ field: def.key, label: def.label, from: show(now), to: String(value), action: blank(now) ? "fill" : same ? "same" : "keep", value });
    }
    if (row.description) compare("description", m.description, row.description, (m.description ?? "").trim() === row.description.trim());
    if (row.links.length) {
      const have = new Set(m.links.map((l) => l.url));
      const added = row.links.filter((l) => !have.has(l.url));
      changes.push({
        field: "links",
        from: m.links.length ? m.links.map((l) => l.label).join(", ") : null,
        to: (added.length ? added : row.links).map((l) => l.label).join(", "),
        action: added.length ? "fill" : "same",
      });
    }
    models.push({ id: m.id, label: m.label, changes });
  }
  return { models, unknownIds, errors };
}

/** The preview's checkbox for one change ("<model id>.<field>"). */
export const pickKey = (modelId: string, field: string) => `${modelId}.${field}`;

/** A change the preview can tick: fills start ticked, kept values unticked. */
export const pickable = (action: ChangeAction) => action === "fill" || action === "keep";

/**
 * What to write for one model: the ticked changes (without `picked`, the
 * fills). A ticked kept value is overwritten with the sheet's. Links are
 * appended, extra fields merged.
 */
export function specUpdate(row: SpecRow, m: CurrentModel, plan: ModelSpecPlan, picked?: Set<string>) {
  const chosen = plan.changes.filter((c) => pickable(c.action) && (picked ? picked.has(pickKey(m.id, c.field)) : c.action === "fill"));
  const write = new Set(chosen.map((c) => c.field));
  const data: Partial<Record<SpecNumberField, number>> & { description?: string; links?: Link[]; customFields?: Record<string, unknown> } = {};
  for (const s of SPEC_NUMBERS) if (write.has(s.field)) data[s.field] = row.numbers[s.field];
  if (write.has("description")) data.description = row.description;
  if (write.has("links")) {
    const have = new Set(m.links.map((l) => l.url));
    data.links = [...m.links, ...row.links.filter((l) => !have.has(l.url))];
  }
  const extra = chosen.filter((c) => c.value !== undefined);
  if (extra.length) data.customFields = { ...m.customFields, ...Object.fromEntries(extra.map((c) => [c.field, c.value])) };
  return { data, changes: chosen };
}
