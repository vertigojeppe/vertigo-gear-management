/**
 * Forgiving text search, shared by the lists and the gear picker. Pure.
 *
 * Spaces, punctuation, case and accents never matter: "qbase" finds
 * "Q Base", "vg12" finds "VG-12", "pointe robe" finds "Robe Pointe" (every
 * word must appear, in any order). When nothing matches that way, close
 * matches are allowed: one typo per word from four letters, two from eight
 * (a wrong, missing, extra or swapped letter), so "pinte" finds "Pointe".
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

/**
 * The searchable text of a row: each field squashed on its own, then all of
 * them run together, so "robepointe" finds manufacturer "Robe" + name
 * "Pointe" while "|" keeps typo matches from straddling two fields.
 */
export function haystack(fields: (string | null | undefined)[]): string {
  const parts = fields.map(squash).filter(Boolean);
  return parts.length > 1 ? [...parts, parts.join("")].join("|") : (parts[0] ?? "");
}

/** 0 = every word appears; 1 = every word appears within its typo allowance; null = no match. */
export function matchLevel(hay: string, words: string[]): 0 | 1 | null {
  if (words.every((w) => hay.includes(w))) return 0;
  if (words.every((w) => substringDistance(w, hay, typosAllowed(w)) <= typosAllowed(w))) return 1;
  return null;
}

/**
 * Filters rows by the query, keeping their order. Exact matches when there
 * are any; otherwise close matches, with `close: true` so the page can say
 * so. An empty query keeps every row.
 */
export function bestMatches<T>(rows: T[], fields: (row: T) => (string | null | undefined)[], query: string | null | undefined): { rows: T[]; close: boolean } {
  const words = searchWords(query);
  if (words.length === 0) return { rows, close: false };
  const hays = rows.map((r) => haystack(fields(r)));
  const exact = rows.filter((_, i) => words.every((w) => hays[i].includes(w)));
  if (exact.length > 0) return { rows: exact, close: false };
  const close = rows.filter((_, i) => matchLevel(hays[i], words) === 1);
  return { rows: close, close: close.length > 0 };
}
