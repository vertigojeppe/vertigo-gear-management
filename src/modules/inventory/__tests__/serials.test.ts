import { describe, expect, it } from "vitest";
import { countUpSerials } from "../serials";

describe("countUpSerials", () => {
  it("counts the last number up, keeping padding, prefix and suffix", () => {
    expect(countUpSerials("VG-0098", 3)).toEqual(["VG-0098", "VG-0099", "VG-0100"]);
    expect(countUpSerials("A1B-99x", 2)).toEqual(["A1B-99x", "A1B-100x"]);
    expect(countUpSerials(" 7 ", 2)).toEqual(["7", "8"]);
    expect(countUpSerials("123456789012345678", 2)).toEqual(["123456789012345678", "123456789012345679"]);
  });

  it("gives up without digits", () => {
    expect(countUpSerials("ABC", 3)).toBeNull();
    expect(countUpSerials("", 3)).toBeNull();
  });
});
