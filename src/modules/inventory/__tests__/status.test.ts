import { describe, expect, it } from "vitest";
import { isAvailableStatus, manualStatuses, validateStatusChange } from "../status";

describe("validateStatusChange", () => {
  it("rejects unknown and no-op changes", () => {
    expect(validateStatusChange("in_house", "nonsense", "x")).toBe("unknown_status");
    expect(validateStatusChange("in_house", "in_house", undefined)).toBe("same_status");
  });

  it("requires a reason for repair, missing and retired", () => {
    expect(validateStatusChange("in_house", "in_repair", undefined)).toBe("reason_required");
    expect(validateStatusChange("in_house", "missing", "   ")).toBe("reason_required");
    expect(validateStatusChange("in_house", "retired", "")).toBe("reason_required");
    expect(validateStatusChange("in_house", "in_repair", "Lamp dead")).toBeNull();
  });

  it("allows returning to in house without a reason", () => {
    expect(validateStatusChange("in_repair", "in_house", undefined)).toBeNull();
    expect(validateStatusChange("missing", "in_house", undefined)).toBeNull();
  });

  it("exposes availability flags from config", () => {
    expect(isAvailableStatus("in_house")).toBe(true);
    expect(isAvailableStatus("on_project")).toBe(true);
    expect(isAvailableStatus("in_repair")).toBe(false);
    expect(isAvailableStatus("missing")).toBe(false);
    expect(isAvailableStatus("retired")).toBe(false);
    expect(isAvailableStatus("under_construction")).toBe(false);
    expect(manualStatuses()).toContain("in_house");
    expect(manualStatuses()).toContain("under_construction");
    expect(validateStatusChange("in_house", "under_construction", undefined)).toBeNull();
  });
});
