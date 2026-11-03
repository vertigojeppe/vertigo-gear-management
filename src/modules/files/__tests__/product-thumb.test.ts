import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { productThumb } from "../service";

/** A wide red product in the middle of a big white picture. */
const picture = (product: boolean) =>
  sharp({ create: { width: 800, height: 800, channels: 3, background: "#ffffff" } })
    .composite(product ? [{ input: { create: { width: 300, height: 100, channels: 3, background: "#cc2222" } }, left: 250, top: 350 }] : [])
    .png()
    .toBuffer();

describe("productThumb", () => {
  it("trims the empty border so the product fills the thumbnail", async () => {
    const meta = await sharp(await productThumb(await picture(true))).metadata();
    expect(meta.width).toBe(480);
    expect(meta.height! / meta.width!).toBeCloseTo(1 / 3, 1);
  });

  it("still makes a thumbnail of a blank picture", async () => {
    const meta = await sharp(await productThumb(await picture(false))).metadata();
    expect(meta.width).toBeGreaterThan(0);
  });
});
