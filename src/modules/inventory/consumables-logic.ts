/**
 * Pure helpers for consumables and spare parts: unit formatting, the
 * running-low check and the packing list's spare suggestion rule. No
 * database access, so they are unit-tested directly.
 */

export const CONSUMABLE_UNITS = ["pcs", "m"] as const;
export type ConsumableUnit = (typeof CONSUMABLE_UNITS)[number];

export function isMetres(unit: string | null | undefined): boolean {
  return unit === "m";
}

/** Metres keep two decimals; pieces are whole numbers. Rounds away float noise from sums. */
export function roundQty(q: number, unit: string): number {
  return isMetres(unit) ? Math.round(q * 100) / 100 : Math.round(q);
}

/** "12,5 m" / "3 pcs" style, Danish decimal comma. `pcsLabel` is the translated word for pieces. */
export function formatQty(q: number, unit: string, pcsLabel = "pcs"): string {
  const n = roundQty(q, unit);
  const text = isMetres(unit) ? n.toLocaleString("da-DK", { maximumFractionDigits: 2 }) : String(n);
  return `${text} ${isMetres(unit) ? "m" : pcsLabel}`;
}

/** Running low when a threshold is set and stock is strictly below it. */
export function isLow(stock: number, minStock: number | null | undefined): boolean {
  return minStock !== null && minStock !== undefined && stock < minStock;
}

export type FitRule = { perUnits: number; minQty: number };

/** Spares to bring for `units` of a model: one per `perUnits`, at least `minQty`; none when there are no units. */
export function sparesFor(units: number, rule: FitRule): number {
  if (units <= 0) return 0;
  const per = Math.max(1, Math.floor(rule.perUnits));
  return Math.max(Math.max(0, Math.floor(rule.minQty)), Math.ceil(units / per));
}

export type SuggestionInput = {
  /** Units of each model on the list (model id → quantity). */
  units: Map<string, number>;
  /** Fit rules: part → the models it fits. */
  fits: { partId: string; modelId: string; perUnits: number; minQty: number }[];
  /** What is already on the list of each part (part id → quantity). */
  onList: Map<string, number>;
  /** Parts in house right now (part id → quantity). */
  inHouse: Map<string, number>;
};

export type Suggestion = {
  partId: string;
  /** What the rules ask for, summed over every fitted model on the list. */
  wanted: number;
  /** Already on the list. */
  onList: number;
  /** Still to add, capped at what is in house. */
  add: number;
  /** Not in house, so not addable: the wish-list gap. */
  short: number;
  /** The models on the list that asked for this part. */
  forModels: string[];
};

/**
 * Packing list spare suggestions: for every part that fits a model on the
 * list, how many the rules want, how many are already on it, and how many
 * more can be added from what is in house. A part that fits several models
 * on the list sums their wants. Parts fully on the list are left out.
 */
export function suggestSpares(input: SuggestionInput): Suggestion[] {
  const byPart = new Map<string, { wanted: number; forModels: string[] }>();
  for (const f of input.fits) {
    const units = input.units.get(f.modelId) ?? 0;
    const want = sparesFor(units, f);
    if (want === 0) continue;
    const cur = byPart.get(f.partId) ?? { wanted: 0, forModels: [] };
    cur.wanted += want;
    cur.forModels.push(f.modelId);
    byPart.set(f.partId, cur);
  }
  const out: Suggestion[] = [];
  for (const [partId, { wanted, forModels }] of byPart) {
    const onList = input.onList.get(partId) ?? 0;
    const missing = Math.max(0, wanted - onList);
    if (missing === 0) continue;
    const available = Math.max(0, input.inHouse.get(partId) ?? 0);
    const add = Math.min(missing, available);
    out.push({ partId, wanted, onList, add, short: missing - add, forModels });
  }
  return out;
}
