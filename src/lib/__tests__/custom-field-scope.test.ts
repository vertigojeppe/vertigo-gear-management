import { describe, expect, it } from "vitest";
import { applicableDefs, type CustomFieldDef } from "../custom-fields";

const global: CustomFieldDef = { key: "condition", label: "Condition", type: "text", options: [], required: false, categoryId: null, categoryIds: null };
const projector: CustomFieldDef = { key: "lumen", label: "Lumen", type: "number", options: [], required: false, categoryId: "projectors", categoryIds: ["projectors", "laser-projectors"] };

describe("applicableDefs", () => {
  it("keeps global fields for every category, including none", () => {
    expect(applicableDefs([global, projector], null).map((d) => d.key)).toEqual(["condition"]);
    expect(applicableDefs([global, projector], "cables").map((d) => d.key)).toEqual(["condition"]);
  });

  it("adds scoped fields for the category and its descendants", () => {
    expect(applicableDefs([global, projector], "projectors").map((d) => d.key)).toEqual(["condition", "lumen"]);
    expect(applicableDefs([global, projector], "laser-projectors").map((d) => d.key)).toEqual(["condition", "lumen"]);
  });

  it("treats a def without scope info as global", () => {
    const legacy = { key: "x", label: "X", type: "text", options: [], required: false } as CustomFieldDef;
    expect(applicableDefs([legacy], "anything")).toHaveLength(1);
  });
});
