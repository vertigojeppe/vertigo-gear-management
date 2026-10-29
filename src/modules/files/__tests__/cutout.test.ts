import { describe, expect, it } from "vitest";
import { cutOutBackground } from "../cutout";

/** A size×size picture filled by `paint(x, y)` → [r, g, b, a]. */
function picture(size: number, paint: (x: number, y: number) => number[]) {
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) px.set(paint(x, y), (y * size + x) * 4);
  return px;
}
const alpha = (px: Uint8Array, size: number, x: number, y: number) => px[(y * size + x) * 4 + 3];

describe("cutOutBackground", () => {
  // A red box on slightly noisy white, with a white window inside the box.
  const product = picture(20, (x, y) => {
    const inBox = x >= 5 && x < 15 && y >= 5 && y < 15;
    if (inBox && x >= 9 && x < 11 && y >= 9 && y < 11) return [255, 255, 255, 255];
    return inBox ? [200, 20, 20, 255] : [250 - ((x + y) % 3) * 4, 250, 248, 255];
  });

  it("clears the background and keeps the item, white parts inside it included", () => {
    const out = cutOutBackground(product, 20, 20)!;
    expect(out).not.toBeNull();
    expect(alpha(out, 20, 0, 0)).toBe(0);
    expect(alpha(out, 20, 2, 17)).toBe(0);
    expect(alpha(out, 20, 7, 7)).toBe(255);
    expect(alpha(out, 20, 9, 9)).toBe(255);
    expect(alpha(product, 20, 0, 0)).toBe(255); // input untouched
  });

  it("leaves busy, already transparent or all-white pictures alone", () => {
    const busy = picture(20, (x, y) => [(x * 37) % 256, (y * 53) % 256, ((x + y) * 19) % 256, 255]);
    expect(cutOutBackground(busy, 20, 20)).toBeNull();
    const cutAlready = picture(20, (x, y) => (x >= 5 && x < 15 && y >= 5 && y < 15 ? [200, 20, 20, 255] : [0, 0, 0, 0]));
    expect(cutOutBackground(cutAlready, 20, 20)).toBeNull();
    const whiteOnWhite = picture(20, (x, y) => (x === 10 && y === 10 ? [240, 240, 240, 255] : [255, 255, 255, 255]));
    expect(cutOutBackground(whiteOnWhite, 20, 20)).toBeNull();
  });
});
