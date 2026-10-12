/**
 * Pure search for the gear picker: what the packing list and template
 * pages show while you type. Entries are models (add N) and kits (add the
 * case). No database here; `gearCatalog` in queries.ts builds the entries.
 */
export type CatalogEntry = {
  kind: "model" | "kit";
  id: string;
  /** "Robe Pointe" or the kit's name. */
  label: string;
  /** "Lighting › Moving heads"; for a kit, its model. */
  category: string;
  trackingType: "serialized" | "bulk" | "kit";
  owned: number;
  inHouse: number;
  /** Quantity already on this list / template (kits: 1 when on it). */
  onList: number;
  /** Asset tags of units (serialized models) so a scanned or typed tag finds the model. */
  tags: string[];
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Every query word must match the label, category or a tag; results are
 * ranked: label starts with the query, then label contains it, then the
 * rest (category / tag matches). Ties keep catalog order.
 */
export function filterCatalog(entries: CatalogEntry[], query: string, limit = 40): CatalogEntry[] {
  const q = norm(query.trim());
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const scored: { e: CatalogEntry; score: number; i: number }[] = [];
  entries.forEach((e, i) => {
    const label = norm(e.label);
    const hay = `${label} ${norm(e.category)} ${e.tags.map(norm).join(" ")}`;
    if (!words.every((w) => hay.includes(w))) return;
    let score = 2;
    if (label.startsWith(q)) score = 0;
    else if (label.includes(q)) score = 1;
    else if (words.every((w) => label.includes(w))) score = 1;
    if (e.tags.some((t) => norm(t) === q)) score = -1; // an exact tag is what a scanner sends
    scored.push({ e, score, i });
  });
  return scored
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.e);
}
