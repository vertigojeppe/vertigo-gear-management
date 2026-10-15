/**
 * Pure search for the gear picker: what the packing list and template
 * pages show while you type. Entries are models (add N) and kits (add the
 * case). No database here; `gearCatalog` in queries.ts builds the entries.
 */
export type CatalogEntry = {
  kind: "model" | "kit";
  id: string;
  /** Full label: "Robe Pointe", "16mm rustfri rods 150cm", or the kit's name. */
  label: string;
  /** The family the entry belongs to: label without the variant ("16mm rustfri rods"); a kit's own name. */
  family: string;
  /** "150cm" for a model variant; null for a model without variants and for kits. */
  variant: string | null;
  /** "Lighting › Moving heads"; for a kit, its model. */
  category: string;
  /** Top category colour and cable length tape colour (palette keys), when any. */
  color: string | null;
  lengthColor: string | null;
  trackingType: "serialized" | "bulk" | "kit";
  owned: number;
  inHouse: number;
  /** Quantity already on this list / template (kits: 1 when on it). */
  onList: number;
  /** Asset tags of units (serialized models) so a scanned or typed tag finds the model. */
  tags: string[];
};

export type CatalogGroup = { key: string; family: string; category: string; kind: CatalogEntry["kind"]; entries: CatalogEntry[] };

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
export function filterCatalog(entries: CatalogEntry[], query: string, limit = 60): CatalogEntry[] {
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

/** Groups ranked results by family, in order of each family's best match; variants keep catalog order inside the group. */
export function groupCatalog(results: CatalogEntry[]): CatalogGroup[] {
  const groups = new Map<string, CatalogGroup>();
  for (const e of results) {
    const key = `${e.kind}:${norm(e.family)}`;
    const g = groups.get(key);
    if (g) g.entries.push(e);
    else groups.set(key, { key, family: e.family, category: e.category, kind: e.kind, entries: [e] });
  }
  return [...groups.values()];
}
