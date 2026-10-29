/**
 * Make a plain photo background see-through: product shots on white or grey.
 *
 * Works on raw RGBA pixels. The background colour is the median of the border;
 * when most of the border is close to it, everything of that colour connected
 * to the border becomes transparent (a flood fill, so white parts inside the
 * item stay), and the ring of pixels just outside it fades for a soft edge.
 * Returns null and leaves the picture alone when the background is busy, the
 * border is already transparent, or the fill would take nearly everything
 * (white gear on white) or nearly nothing.
 */
export function cutOutBackground(rgba: Uint8Array, width: number, height: number, tolerance = 28): Uint8Array | null {
  const n = width * height;
  if (width < 3 || height < 3 || rgba.length !== n * 4) return null;

  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);

  if (border.filter((p) => rgba[p * 4 + 3] < 250).length > border.length / 2) return null;
  const median = (c: number) => border.map((p) => rgba[p * 4 + c]).sort((a, b) => a - b)[border.length >> 1];
  const bg = [median(0), median(1), median(2)];
  const dist = (p: number) => Math.max(Math.abs(rgba[p * 4] - bg[0]), Math.abs(rgba[p * 4 + 1] - bg[1]), Math.abs(rgba[p * 4 + 2] - bg[2]));
  if (border.filter((p) => dist(p) <= tolerance).length < border.length * 0.9) return null;

  const removed = new Uint8Array(n);
  const stack = border.filter((p) => dist(p) <= tolerance);
  for (const p of stack) removed[p] = 1;
  let count = stack.length;
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % width;
    for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
      if (q < 0 || q >= n || removed[q] || dist(q) > tolerance) continue;
      removed[q] = 1;
      count++;
      stack.push(q);
    }
  }
  if (count > n * 0.97 || count < n * 0.02) return null;

  const out = Uint8Array.from(rgba);
  for (let p = 0; p < n; p++) {
    if (removed[p]) {
      out[p * 4 + 3] = 0;
      continue;
    }
    const x = p % width;
    const touches = (x > 0 && removed[p - 1]) || (x < width - 1 && removed[p + 1]) || (p >= width && removed[p - width]) || (p + width < n && removed[p + width]);
    // Anti-aliased edge pixels are part background: fade them so no light halo shows on a dark page.
    if (touches) out[p * 4 + 3] = Math.round(rgba[p * 4 + 3] * Math.min(1, (dist(p) - tolerance) / (tolerance * 3)));
  }
  return out;
}
