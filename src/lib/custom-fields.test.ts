import { describe, expect, it } from "vitest";
import { customFieldKeySchema, validateCustomFields, type CustomFieldDef } from "./custom-fields";

const defs: CustomFieldDef[] = [
  { key: "lamp_hours", label: "Lamp hours", type: "number", options: [], required: false },
  { key: "lens", label: "Lens", type: "select", options: ["0.8", "1.2-1.8", "2.0-3.0"], required: true },
  { key: "service_date", label: "Last service", type: "date", options: [], required: false },
  { key: "flightcase", label: "Has flight case", type: "checkbox", options: [], required: false },
  { key: "manual_url", label: "Manual", type: "url", options: [], required: false },
  { key: "note", label: "Note", type: "text", options: [], required: false },
];

describe("validateCustomFields", () => {
  it("accepts valid values and coerces types", () => {
    const r = validateCustomFields(defs, { lamp_hours: "1200", lens: "1.2-1.8", service_date: "2026-03-01", flightcase: "on", manual_url: "https://x.y/m.pdf", note: "ok" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values.lamp_hours).toBe(1200);
      expect(r.values.flightcase).toBe(true);
      expect(r.values.lens).toBe("1.2-1.8");
    }
  });

  it("treats empty strings as missing and enforces required", () => {
    const r = validateCustomFields(defs, { lamp_hours: "", lens: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.lens).toMatch(/required/i);
      expect(r.errors.lamp_hours).toBeUndefined();
    }
  });

  it("rejects bad numbers, dates, urls and options", () => {
    const r = validateCustomFields(defs, { lamp_hours: "abc", lens: "9.9", service_date: "01.03.2026", manual_url: "not a url" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(["lamp_hours", "lens", "manual_url", "service_date"]);
    }
  });

  it("unchecked checkbox becomes false", () => {
    const r = validateCustomFields(defs, { lens: "0.8" });
    expect(r.ok && r.values.flightcase).toBe(false);
  });

  it("validates keys", () => {
    expect(customFieldKeySchema.safeParse("lamp_hours").success).toBe(true);
    expect(customFieldKeySchema.safeParse("Lamp Hours").success).toBe(false);
    expect(customFieldKeySchema.safeParse("1abc").success).toBe(false);
  });
});
