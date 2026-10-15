import { colorHex, variantMetres } from "@/lib/colors";

export type ColorRow = { id: string; parentId: string | null; color: string | null; lengthColors: boolean };
export type CategoryColoring = { color: string | null; lengthColors: boolean };

/**
 * Pure: every category → the colour and the "tape by length" flag of its
 * top-level ancestor. Colours are set on top-level categories only and
 * inherited downwards; a colour set on a child is ignored.
 */
export function categoryColorMap(rows: ColorRow[]): Map<string, CategoryColoring> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out = new Map<string, CategoryColoring>();
  for (const r of rows) {
    let top = r;
    let guard = 0;
    while (top.parentId && byId.has(top.parentId) && guard++ < 100) top = byId.get(top.parentId)!;
    out.set(r.id, { color: top.color, lengthColors: top.lengthColors });
  }
  return out;
}

/** The dot colour for a cable variant ("5 m" → red) when its category uses tape colours; null otherwise. */
export function lengthColorFor(variant: string | null | undefined, coloring: CategoryColoring | undefined, lengths: Map<number, string>): string | null {
  if (!coloring?.lengthColors) return null;
  const metres = variantMetres(variant);
  if (metres === null) return null;
  return lengths.get(metres) ?? null;
}

/** Hex pair for the UI atoms, from the stored keys. */
export function marks(categoryColor: string | null | undefined, lengthColor: string | null | undefined): { bar: string | null; dot: string | null } {
  return { bar: colorHex(categoryColor), dot: colorHex(lengthColor) };
}
