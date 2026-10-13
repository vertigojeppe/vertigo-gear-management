/**
 * Models come in families that differ only by a size: "16 mm rustfri rods"
 * in 50, 70, 100 cm, "DMX 5-pin" in 5, 10, 25 m, "BlackLED controller" in
 * 4 or 6 outputs. The family is `Model.name`, the size is `Model.variant`,
 * and the label is both. This file is pure: splitting a legacy combined
 * name, and sorting variants by their number instead of alphabetically.
 *
 * Every pattern here has a twin in a data migration (prisma/migrations),
 * so what the importer produces and what the database holds stay equal.
 */

const SIZE = String.raw`\d+(?:[.,]\d+)?\s*(?:cm|mm|m)\b\.?`;
const PATTERNS: RegExp[] = [
  // "Ethercon-LP12(M-M) 20cm", "Ethercon-LP12(F-F) Granat": the connector genders and what follows are the variation
  /^(.*?\S)\s*(\([FMfm]-[FMfm]\).*)$/,
  // "Alu hjørner 30° grader", "kube corner 3 x 90°", "45 grader"
  /^(.*?\S)\s+((?:\d+\s*x\s*)?\d+\s*°(?:\s*grader)?|\d+\s*grader)$/i,
  // "DMX 5-pin 5 m", "Scroller 1,5 m. (tynd)", "rods 150cm med forlænger", "True1 5 m (Wieland)"
  new RegExp(String.raw`^(.*?\S)\s+(${SIZE}(?:\s+med forlænger)?(?:\s*\([^)]*\))*)$`, "i"),
  // "LASER spejle 76 x 76 mm · Mirror 4-6 Wave"
  /^(.*?\S)\s+(\d+\s*x\s*\d+\s*(?:mm|cm)(?:\s*·.*)?)$/i,
  // "BlackLED controller 6 udgange (450w) (Wieland)"
  /^(.*?\S)\s+(\d+\s+udgange\b.*)$/i,
  // "KITO 500 kg", "Lodestar D8+ 1 t"
  /^(.*?\S)\s+(\d+(?:[.,]\d+)?\s*(?:kg|t))$/i,
];

/** "DMX 5-pin 5 m" → { name: "DMX 5-pin", variant: "5 m" }; a name without a size keeps variant null. */
export function splitVariant(fullName: string): { name: string; variant: string | null } {
  const s = fullName.replace(/\s+/g, " ").trim();
  for (const re of PATTERNS) {
    const m = s.match(re);
    // Never cut inside a parenthesis ("Wind Up Stativ (max højde = 3,66m" lost its bracket on the sheet).
    if (m && m[1].trim() && (m[1].match(/\(/g) ?? []).length === (m[1].match(/\)/g) ?? []).length) {
      // "1,5 m. (tynd)" → "1,5 m (tynd)": the sheet wrote the unit with a full stop.
      return { name: m[1].trim(), variant: m[2].replace(/\.(?=\s*(?:\(|$))/, "").trim() };
    }
  }
  return { name: s, variant: null };
}

/** Sorts "50 cm" < "70 cm" < "100 cm" < "1,5 m" < "2 m" (metres after centimetres), text variants last, alphabetically. */
export function compareVariants(a: string | null | undefined, b: string | null | undefined): number {
  const ka = variantKey(a);
  const kb = variantKey(b);
  if (ka.n !== kb.n) return ka.n - kb.n;
  return ka.text.localeCompare(kb.text, undefined, { numeric: true, sensitivity: "base" });
}

function variantKey(v: string | null | undefined): { n: number; text: string } {
  const text = (v ?? "").trim();
  if (!text) return { n: -1, text: "" };
  const m = text.match(/^(\d+(?:[.,]\d+)?)\s*(cm|mm|m|kg|t|°)?\b/i);
  if (!m) return { n: Number.MAX_SAFE_INTEGER, text };
  const value = Number(m[1].replace(",", "."));
  const unit = (m[2] ?? "").toLowerCase();
  const factor = unit === "mm" ? 0.001 : unit === "cm" ? 0.01 : unit === "t" ? 1000 : 1;
  return { n: value * factor, text };
}
