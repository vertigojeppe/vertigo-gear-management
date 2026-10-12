import { describe, expect, it } from "vitest";
import { hasWebGL } from "../webgl";

describe("hasWebGL", () => {
  it("is true when any WebGL context can be created", () => {
    expect(hasWebGL(() => ({ getContext: (id) => (id === "webgl2" ? {} : null) }))).toBe(true);
    expect(hasWebGL(() => ({ getContext: (id) => (id === "webgl" ? {} : null) }))).toBe(true);
    expect(hasWebGL(() => ({ getContext: (id) => (id === "experimental-webgl" ? {} : null) }))).toBe(true);
  });

  it("is false without a context, without a canvas, or when the probe throws", () => {
    expect(hasWebGL(() => ({ getContext: () => null }))).toBe(false);
    expect(hasWebGL(() => null)).toBe(false);
    expect(
      hasWebGL(() => ({
        getContext: () => {
          throw new Error("Error creating WebGL context");
        },
      })),
    ).toBe(false);
  });

  it("is false where there is no document at all (server)", () => {
    expect(hasWebGL()).toBe(false);
  });
});
