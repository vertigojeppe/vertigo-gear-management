import { describe, expect, it } from "vitest";
import { planarTensor, sigmoidMask } from "../background";

describe("background model input and output", () => {
  it("lays RGB out as three normalised planes", () => {
    // 2×2 pixels: white, then three black.
    const t = planarTensor(Uint8Array.from([255, 255, 255, ...Array(9).fill(0)]), 2);
    const plane = 4;
    expect(t[0]).toBeCloseTo((1 - 0.485) / 0.229); // R of pixel 0
    expect(t[1]).toBeCloseTo((0 - 0.485) / 0.229); // R of pixel 1
    expect(t[plane]).toBeCloseTo((1 - 0.456) / 0.224); // G of pixel 0
    expect(t[2 * plane + 1]).toBeCloseTo((0 - 0.406) / 0.225); // B of pixel 1
  });

  it("turns scores into alpha: background clear, item solid", () => {
    expect([...sigmoidMask(Float32Array.from([-20, 0, 20]))]).toEqual([0, 128, 255]);
  });
});
