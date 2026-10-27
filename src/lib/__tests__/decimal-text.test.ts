import { describe, expect, it } from "vitest";
import { z } from "zod";
import { decimal, decimalText, optionalNumber } from "../forms";
import { fieldSchema } from "../custom-fields";

describe("decimalText", () => {
  it("takes a decimal comma or point", () => {
    expect(decimalText("12,5")).toBe("12.5");
    expect(decimalText("12.5")).toBe("12.5");
    expect(decimalText(" 0,75 ")).toBe("0.75");
  });

  it("reads thousands with both marks, the last one being the decimal", () => {
    expect(decimalText("1.234,50")).toBe("1234.50");
    expect(decimalText("1,234.50")).toBe("1234.50");
    expect(decimalText("12 500,5")).toBe("12500.5");
    expect(decimalText("12 500")).toBe("12500");
  });

  it("leaves what it cannot read for the schema to refuse", () => {
    expect(decimalText("1,2,3")).toBe("1,2,3");
    expect(decimalText(4)).toBe(4);
    expect(decimalText(undefined)).toBe(undefined);
  });
});

describe("number schemas", () => {
  it("optionalNumber reads a comma and keeps empty as undefined", () => {
    expect(optionalNumber.parse("2,5")).toBe(2.5);
    expect(optionalNumber.parse("")).toBeUndefined();
    expect(optionalNumber.safeParse("1,2,3").success).toBe(false);
  });

  it("decimal() wraps a required number", () => {
    expect(decimal(z.coerce.number().positive()).parse("0,5")).toBe(0.5);
  });

  it("number extra fields read a comma", () => {
    const schema = fieldSchema({ key: "throw", label: "Throw ratio", type: "number", options: [], required: false } as never);
    expect(schema.parse("1,15")).toBe(1.15);
  });
});
