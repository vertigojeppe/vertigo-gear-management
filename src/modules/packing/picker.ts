/**
 * Pure search for the gear picker: what the packing list and template
 * pages show while you type. Entries are models (add N) and kits (add the
 * case). No database here; `gearCatalog` in queries.ts builds the entries.
 */
import { exactHit, haystack, matchLevel, queryTerms, squash, type Glossary } from "@/lib/search";

export type CatalogEntry = {
  kind: "model" | "kit";
  id: string;
  /** Full label: "Robe Pointe", "16mm rustfri rods 150cm", or the kit's name. */
  label: string;
  /** The family the entry belongs to: label without the variant ("16mm rustfri rods"); a kit's own name. */
  family: string;
  /** "150cm" for a model variant; null for a model without variants and for kits. */
  variant: string | null;
  /** The model's manufacturer, shown grey beside the name ("" for kits and own-built gear). */
  manufacturer: string;
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
 * Every query word must match the label, category or a tag, ignoring
 * spaces, case, punctuation and accents ("qbase" finds "Q Base"). Results
 * are ranked: label starts with the query, then label contains it, then the
 * rest (category / tag matches). Ties keep catalog order. When nothing
 * matches, close matches (a typo per word) are returned with `close`.
 */
export function searchCatalog(entries: CatalogEntry[], query: string, limit = 60, glossary?: Glossary): { results: CatalogEntry[]; close: boolean } {
  const words = queryTerms(query, glossary);
  if (words.length === 0) return { results: [], close: false };
  const q = squash(query);
  const { hays, labels, tags } = indexOf(entries);
  const scored: { e: CatalogEntry; score: number; i: number }[] = [];
  entries.forEach((e, i) => {
    if (!exactHit(hays[i], words)) return;
    const label = labels[i];
    let score = 2;
    if (label.startsWith(q)) score = 0;
    else if (label.includes(q)) score = 1;
    else if (words.every((alts) => alts.some((w) => label.includes(w)))) score = 1;
    if (tags[i].includes(q)) score = -1; // an exact tag is what a scanner sends
    scored.push({ e, score, i });
  });
  let close = false;
  if (scored.length === 0) {
    entries.forEach((e, i) => {
      if (matchLevel(hays[i], words) === 1) scored.push({ e, score: 3, i });
    });
    close = scored.length > 0;
  }
  const results = scored
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.e);
  return { results, close };
}

/** Normalised text per entry, built once per catalog array (the picker searches the same one on every keystroke). */
const indexCache = new WeakMap<CatalogEntry[], { hays: string[]; labels: string[]; tags: string[][] }>();
function indexOf(entries: CatalogEntry[]) {
  let index = indexCache.get(entries);
  if (!index) {
    index = { hays: entries.map((e) => haystack([e.label, e.manufacturer, e.category, ...e.tags])), labels: entries.map((e) => squash(e.label)), tags: entries.map((e) => e.tags.map(squash)) };
    indexCache.set(entries, index);
  }
  return index;
}

/** `searchCatalog` without the close-match flag. */
export function filterCatalog(entries: CatalogEntry[], query: string, limit = 60): CatalogEntry[] {
  return searchCatalog(entries, query, limit).results;
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
