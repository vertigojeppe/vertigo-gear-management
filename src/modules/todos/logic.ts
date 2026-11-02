/** Open to-dos under their category: no category first, then categories A–Z (Danish order). Rows keep their order. */
export function groupTodos<T extends { category: string | null }>(rows: T[]): { category: string | null; rows: T[] }[] {
  const groups = new Map<string | null, T[]>();
  for (const r of rows) groups.set(r.category, [...(groups.get(r.category) ?? []), r]);
  return [...groups.entries()].sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : a.localeCompare(b, "da"))).map(([category, rows]) => ({ category, rows }));
}

/** The group's ids with `id` moved one step up or down; unchanged at the ends. */
export function moved(ids: string[], id: string, dir: "up" | "down"): string[] {
  const i = ids.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const out = [...ids];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
