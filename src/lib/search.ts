/**
 * Forgiving text search, shared by the lists and the gear picker. Pure.
 *
 * Spaces, punctuation, case and accents never matter: "qbase" finds
 * "Q Base", "vg12" finds "VG-12", "pointe robe" finds "Robe Pointe" (every
 * word must appear, in any order). When nothing matches that way, close
 * matches are allowed: one typo per word from four letters, two from eight
 * (a wrong, missing, extra or swapped letter), so "pinte" finds "Pointe".
 * With a glossary (Settings › Search words), a word also matches the words
 * it is grouped with: "arbejdslys" finds "Worklight".
 */

/** Lower case, accents off, spaces and punctuation out: "Q-Base 2" → "qbase2". æ and ø stay. */
export function squash(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

/** The query as squashed words; empty when there is nothing to search for. */
export function searchWords(query: string | null | undefined): string[] {
  if (!query) return [];
  return query.split(/\s+/).map(squash).filter(Boolean);
}

/** How many typos a word of this length may carry in a close match. */
export function typosAllowed(word: string): number {
  return word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0;
}

/**
 * Fewest edits (substitute, insert, delete, swap two neighbours) that turn
 * `word` into some substring of `text`. Stops early once it cannot get
 * under `max + 1`.
 */
export function substringDistance(word: string, text: string, max: number): number {
  const m = word.length;
  if (m === 0) return 0;
  if (text.includes(word)) return 0;
  // Rows over text positions; column 0 is free (a match may start anywhere).
  let prev2: number[] = new Array(text.length + 1).fill(0);
  let prev: number[] = new Array(text.length + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    const cur: number[] = new Array(text.length + 1);
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= text.length; j++) {
      const cost = word[i - 1] === text[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && word[i - 1] === text[j - 2] && word[i - 2] === text[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return Math.min(...prev);
}

/** Marks the start of a word in the haystack's last section. */
const WORD = "^";

/**
 * The searchable text of a row: each field squashed on its own, then all of
 * them run together, so "robepointe" finds manufacturer "Robe" + name
 * "Pointe" while "|" keeps typo matches from straddling two fields. A last
 * section lists every word with "^" in front, for matches that must start
 * a word (short glossary partners: "lamp" in "Lamp projectors", not in
 * "Clamps").
 */
export function haystack(fields: (string | null | undefined)[]): string {
  const parts = fields.map(squash).filter(Boolean);
  const text = parts.length > 1 ? [...parts, parts.join("")].join("|") : (parts[0] ?? "");
  const words = fields.flatMap((f) => (f ? f.split(/[\s\p{P}\p{S}]+/u).map(squash).filter(Boolean) : []));
  return words.length ? `${text}|${words.map((w) => WORD + w).join("")}` : text;
}

/** Word groups that mean the same: each squashed term → every squashed term it is grouped with (itself included). */
export type Glossary = Map<string, string[]>;

/** Builds the lookup from groups like ["arbejdslys", "worklight", "work light"]; a term in several groups gets them all. */
export function buildGlossary(groups: string[][]): Glossary {
  const map = new Map<string, Set<string>>();
  for (const group of groups) {
    const terms = [...new Set(group.map(squash).filter(Boolean))];
    if (terms.length < 2) continue;
    for (const t of terms) {
      const set = map.get(t) ?? new Set<string>();
      for (const x of terms) set.add(x);
      map.set(t, set);
    }
  }
  return new Map([...map].map(([k, v]) => [k, [...v]]));
}

const MAX_PHRASE = 3;

/**
 * The query as alternatives per word: "arbejdslys led" with a glossary →
 * [["arbejdslys", "worklight", …], ["led"]]. Up to three neighbouring words
 * may form one glossary term ("work light" → "worklight"); without a
 * glossary every word is its own single alternative.
 */
export function queryTerms(query: string | null | undefined, glossary?: Glossary): string[][] {
  const words = searchWords(query);
  if (!glossary?.size) return words.map((w) => [w]);
  const out: string[][] = [];
  for (let i = 0; i < words.length; ) {
    let n = Math.min(MAX_PHRASE, words.length - i);
    for (; n > 1 && !glossary.has(words.slice(i, i + n).join("")); n--);
    const term = words.slice(i, i + n).join("");
    const partners = glossary.get(term);
    // The word as typed first: it matches anywhere; its partners are held to stricter rules (exactHit).
    out.push(partners ? [term, ...partners.filter((p) => p !== term)] : [term]);
    i += n;
  }
  return out;
}

type Terms = (string | string[])[];
const alternatives = (terms: Terms) => terms.map((t) => (Array.isArray(t) ? t : [t]));
/** Glossary partners shorter than this must start a word, so "lamp" does not find "clamp" while "kabel" still finds "Strømkabel". */
const SHORT_PARTNER = 5;
export const exactHit = (hay: string, terms: string[][]) => terms.every((alts) => alts.some((a, k) => (k > 0 && a.length < SHORT_PARTNER ? hay.includes(WORD + a) : hay.includes(a))));

/** 0 = every word (or one of its glossary partners) appears; 1 = the same within the typo allowance; null = no match. */
export function matchLevel(hay: string, words: Terms): 0 | 1 | null {
  const terms = alternatives(words);
  if (exactHit(hay, terms)) return 0;
  if (terms.every((alts) => alts.some((a) => substringDistance(a, hay, typosAllowed(a)) <= typosAllowed(a)))) return 1;
  return null;
}

/**
 * Filters rows by the query, keeping their order. Exact matches when there
 * are any; otherwise close matches, with `close: true` so the page can say
 * so. An empty query keeps every row. Pass the glossary to let a word find
 * its partners.
 */
export function bestMatches<T>(rows: T[], fields: (row: T) => (string | null | undefined)[], query: string | null | undefined, glossary?: Glossary): { rows: T[]; close: boolean } {
  const terms = queryTerms(query, glossary);
  if (terms.length === 0) return { rows, close: false };
  const hays = rows.map((r) => haystack(fields(r)));
  const exact = rows.filter((_, i) => exactHit(hays[i], terms));
  if (exact.length > 0) return { rows: exact, close: false };
  const close = rows.filter((_, i) => matchLevel(hays[i], terms) === 1);
  return { rows: close, close: close.length > 0 };
}

/**
 * Settings › Search words as text: one group per line, words separated by
 * commas. Returns the groups, or the 1-based numbers of lines with fewer
 * than two different words.
 */
export function parseGlossaryText(text: string): { groups: string[][]; badLines: number[] } {
  const groups: string[][] = [];
  const badLines: number[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || line.trim().startsWith("#")) return;
    const seen = new Set<string>();
    const terms: string[] = [];
    for (const raw of line.split(/[,;]/)) {
      const term = raw.trim().replace(/\s+/g, " ");
      const key = squash(term);
      if (key && !seen.has(key)) {
        seen.add(key);
        terms.push(term);
      }
    }
    if (terms.length < 2) badLines.push(i + 1);
    else groups.push(terms);
  });
  return { groups, badLines };
}
