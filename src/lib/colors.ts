/**
 * The fixed palette for colour coding (category bars, cable length dots).
 * Mid-tone colours that read on both the light and the night background;
 * "white" is the one exception (it is a real tape colour) and gets a
 * border when drawn. Keys are stored in the database; hex values are
 * rendered inline, never as Tailwind class names.
 */
export const COLOR_PALETTE = [
  { key: "red", hex: "#e5484d" },
  { key: "orange", hex: "#f76b15" },
  { key: "amber", hex: "#f5a524" },
  { key: "yellow", hex: "#e4c100" },
  { key: "lime", hex: "#8bc34a" },
  { key: "green", hex: "#30a46c" },
  { key: "teal", hex: "#12a594" },
  { key: "cyan", hex: "#0ea5e9" },
  { key: "blue", hex: "#3b82f6" },
  { key: "indigo", hex: "#6366f1" },
  { key: "purple", hex: "#8e4ec6" },
  { key: "pink", hex: "#e93d82" },
  { key: "brown", hex: "#a16207" },
  { key: "gray", hex: "#8b8d98" },
  { key: "white", hex: "#f4f4f5" },
  { key: "black", hex: "#1c1c1f" },
] as const;

export type ColorKey = (typeof COLOR_PALETTE)[number]["key"];
export const COLOR_KEYS = COLOR_PALETTE.map((c) => c.key) as ColorKey[];

export function isColorKey(v: unknown): v is ColorKey {
  return typeof v === "string" && (COLOR_KEYS as string[]).includes(v);
}

/** Hex for a stored key; null for unknown or missing. */
export function colorHex(key: string | null | undefined): string | null {
  if (!key) return null;
  return COLOR_PALETTE.find((c) => c.key === key)?.hex ?? null;
}

/** Colours that need an outline to be seen on either background. */
export function needsOutline(key: string | null | undefined): boolean {
  return key === "white" || key === "black";
}

/** "2,5 m", "5 m", "150 cm", "10m" → metres; null when the variant is not a plain length. */
export function variantMetres(variant: string | null | undefined): number | null {
  if (!variant) return null;
  const m = variant.trim().match(/^(\d+(?:[.,]\d+)?)\s*(m|cm|mm)\b/i);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const unit = m[2].toLowerCase();
  return unit === "m" ? n : unit === "cm" ? n / 100 : n / 1000;
}
