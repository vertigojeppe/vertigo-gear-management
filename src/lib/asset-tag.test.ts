import { describe, expect, it } from "vitest";
import { formatAssetTag, normaliseAssetTag, parseScannedTag } from "./asset-tag";

describe("asset tags", () => {
  it("formats with prefix and padding", () => {
    expect(formatAssetTag(42)).toBe("VG-0042");
    expect(formatAssetTag(12345)).toBe("VG-12345");
  });

  it("normalises sloppy input", () => {
    expect(normaliseAssetTag(" vg-42 ")).toBe("VG-0042");
    expect(normaliseAssetTag("VG0042")).toBe("VG-0042");
    expect(normaliseAssetTag("hello")).toBeNull();
  });

  it("parses scanned URLs and bare tags", () => {
    expect(parseScannedTag("https://gear.vertigo.dk/t/VG-0042")).toBe("VG-0042");
    expect(parseScannedTag("http://localhost:3000/t/VG-0007?x=1")).toBe("VG-0007");
    expect(parseScannedTag("VG-7")).toBe("VG-0007");
    expect(parseScannedTag("https://example.com/other")).toBeNull();
  });
});
