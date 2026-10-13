import { describe, expect, it } from "vitest";
import { compareVariants, splitVariant } from "../variant";

describe("splitVariant", () => {
  it("splits a trailing size off the family name", () => {
    expect(splitVariant("DMX 5-pin 5 m")).toEqual({ name: "DMX 5-pin", variant: "5 m" });
    expect(splitVariant("16mm rustfri rods 150cm")).toEqual({ name: "16mm rustfri rods", variant: "150cm" });
    expect(splitVariant("28mm rustfri rods i 28x1,5mm 150cm med forlænger")).toEqual({ name: "28mm rustfri rods i 28x1,5mm", variant: "150cm med forlænger" });
    expect(splitVariant("Scroller 1,5 m. (tynd)")).toEqual({ name: "Scroller", variant: "1,5 m (tynd)" });
    expect(splitVariant("H30V 3 m")).toEqual({ name: "H30V", variant: "3 m" });
    expect(splitVariant("BlackLED controller 6 udgange (450w) (Wieland)")).toEqual({ name: "BlackLED controller", variant: "6 udgange (450w) (Wieland)" });
    expect(splitVariant("LASER spejle 76 x 76 mm · Mirror 4-6 Wave")).toEqual({ name: "LASER spejle", variant: "76 x 76 mm · Mirror 4-6 Wave" });
    expect(splitVariant("KITO 500 kg")).toEqual({ name: "KITO", variant: "500 kg" });
    expect(splitVariant("Alu hjørner 30° grader")).toEqual({ name: "Alu hjørner", variant: "30° grader" });
    expect(splitVariant("Alu hjørner kube corner 3 x 90°")).toEqual({ name: "Alu hjørner kube corner", variant: "3 x 90°" });
    expect(splitVariant("Ethercon-LP12(M-M) 20cm")).toEqual({ name: "Ethercon-LP12", variant: "(M-M) 20cm" });
    expect(splitVariant("Ethercon-LP12(F-F) Granat")).toEqual({ name: "Ethercon-LP12", variant: "(F-F) Granat" });
    expect(splitVariant("Ethercon-LP12(F-M)")).toEqual({ name: "Ethercon-LP12", variant: "(F-M)" });
    expect(splitVariant("True1 under 2 m")).toEqual({ name: "True1", variant: "under 2 m" });
    expect(splitVariant("Stativ max. 3,5 m (tung)")).toEqual({ name: "Stativ", variant: "max. 3,5 m (tung)" });
  });
  it("leaves names without a size alone", () => {
    expect(splitVariant("Pointe")).toEqual({ name: "Pointe", variant: null });
    expect(splitVariant("MAC Aura XB")).toEqual({ name: "MAC Aura XB", variant: null });
    expect(splitVariant("PT-RZ120")).toEqual({ name: "PT-RZ120", variant: null });
    expect(splitVariant("Half coupler 50 mm")).toEqual({ name: "Half coupler", variant: "50 mm" });
    expect(splitVariant("5 m")).toEqual({ name: "5 m", variant: null }); // nothing left for a name
    expect(splitVariant("387XBU Wind Up Stativ (max højde = 3,66m")).toEqual({ name: "387XBU Wind Up Stativ (max højde = 3,66m", variant: null }); // unbalanced bracket
  });
});

describe("compareVariants", () => {
  it("orders by size, metres after centimetres, text last", () => {
    const sorted = ["2 m", "100 cm", "50cm", "1,5 m", "lang", null, "70 cm"].sort(compareVariants);
    expect(sorted).toEqual([null, "50cm", "70 cm", "100 cm", "1,5 m", "2 m", "lang"]);
  });
});
