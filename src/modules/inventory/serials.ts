/**
 * `count` serial numbers counting up from `first` (pure): the last run of
 * digits goes up by one, keeping its zero padding ("VG-0099" → "VG-0100").
 * Null when `first` has no digits.
 */
export function countUpSerials(first: string, count: number): string[] | null {
  const m = /^(.*?)(\d+)(\D*)$/.exec(first.trim());
  if (!m) return null;
  const [, before, digits, after] = m;
  const start = BigInt(digits); // serials can be longer than a safe integer
  return Array.from({ length: count }, (_, i) => `${before}${(start + BigInt(i)).toString().padStart(digits.length, "0")}${after}`);
}
