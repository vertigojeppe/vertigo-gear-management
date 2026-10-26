import { describe, expect, it } from "vitest";
import { listFieldText } from "../custom-fields";

describe("listFieldText", () => {
  it("puts the label after numbers and before everything else", () => {
    expect(listFieldText({ label: "Lumen", type: "number" }, 3500)).toBe("3.500 Lumen");
    expect(listFieldText({ label: "Throw ratio", type: "text" }, "1.15–1.5")).toBe("Throw ratio 1.15–1.5");
    expect(listFieldText({ label: "Finish", type: "select" }, "Black painted")).toBe("Finish Black painted");
  });

  it("shows a ticked checkbox as its label and leaves empty values out", () => {
    expect(listFieldText({ label: "Rigging points", type: "checkbox" }, true)).toBe("Rigging points");
    for (const empty of [null, undefined, "", false]) expect(listFieldText({ label: "Lumen", type: "number" }, empty)).toBeNull();
  });
});
