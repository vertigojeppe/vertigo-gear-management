import ExcelJS from "exceljs";

/**
 * A small synthetic workbook with the same sheet names and column layouts
 * as "Vertigo Gearliste _ Status.xlsx" (which stays out of git). `marker`
 * goes into the names the tests look up, so parallel runs and leftovers
 * never collide. Row numbers below are referenced by the tests.
 */
export function buildFixtureWorkbook(marker: string): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const put = (ws: ExcelJS.Worksheet, row: number, cells: Record<string, string | number>) => {
    for (const [col, v] of Object.entries(cells)) ws.getCell(`${col}${row}`).value = v;
  };

  // Main inventory sheet: A category, B system, C variant, D price, E weight, F total,
  // G minus, H loan name, I loan qty, J repair, K missing, L under construction, M note.
  const main = wb.addWorksheet("LED - SCROLLER - BOX");
  put(main, 1, { A: "Vertigo gear" });
  put(main, 3, { A: "Hvad", B: "Type", C: "Str.", D: "Pris", E: "Vægt", F: "I alt", G: "Minus rep/missing", H: "Udlån", I: "Antal", J: "Rep", K: "Missing", L: "Under opbygning", M: "Note" });
  put(main, 4, { A: "Kabler" });
  put(main, 5, { B: `True1 ${marker} kabler` });
  put(main, 6, { C: "5 m", D: "25", E: "0,5 kg", F: "10", J: "1" });
  put(main, 7, { C: "10 m", F: "19(old)+ 9 (new)", H: "ukirke", I: "2" });
  put(main, 8, { A: "LED" });
  put(main, 9, { B: `SplitLED ${marker}` });
  put(main, 10, { B: "[5 A pr. fixtur]", C: "60cm", E: "2 kg", F: "8", M: "Fordelt til 2 stk flightcase" });
  put(main, 11, { A: "Bokse" });
  put(main, 12, { B: "BlackLED controller" });
  put(main, 13, { C: "4 udgange (200w)", E: "2 kg", F: "3", L: "1" });
  put(main, 14, { A: "Stativer" });
  put(main, 15, { B: `KITO ${marker}`, C: "500 kg", F: "2" });
  put(main, 16, { A: "Lamper" });
  put(main, 17, { B: "EclGalleryProfile FC 60W RGBW", F: "4" });

  // Controllers: B id, C ip, D board, E status, F firmware, M note with a corrected id.
  const ctl = wb.addWorksheet("LEDController Optælling");
  put(ctl, 1, { B: "ID", C: "IP", D: "Board", E: "Status", F: "Firmware" });
  put(ctl, 2, { B: "W6-91", C: "192.168.1.10", D: "Teensy 4.0", E: "OK", F: "v2.1" });
  put(ctl, 3, { B: "N4-91", C: "192.168.1.20", D: "Teensy 3.2", E: "ERROR no output" });
  put(ctl, 4, { B: "W6-92", C: "192.168.1.11", D: "Teensy 4.0", M: "ID: N4-91" });
  put(ctl, 5, { B: "N6-91" });

  // Projectors: rows 1–5 are headings; A id, B model, C lumen, D throw, E lens shift,
  // F resolution, G day price or "ikke til udleje", H–L notes (J serial, I location).
  const proj = wb.addWorksheet("PROJEKTORE");
  put(proj, 1, { A: "Projektorer" });
  put(proj, 6, { A: "ID", B: "Model", C: "Lumen", D: "Throw", E: "Lens shift", F: "Res", G: "Pris/dag" });
  put(proj, 7, { A: "ZP1", B: `Panasonic PT-VZ ${marker}`, C: "4500 Lumen", D: "1.2:1", E: "V +50%", F: "WUXGA", G: "900", H: "Lånt til LASSE", J: "ABCDEFGHIJ12" });
  put(proj, 8, { A: "ZP2", B: `Panasonic PT-VZ ${marker}`, C: "4500 Lumen", G: "ikke til udleje", H: "Solgt 2023" });
  put(proj, 9, { A: "GearGuys" });
  put(proj, 10, { B: "Barco UDX-4K32", D: "0.8:1", F: "4K" });
  put(proj, 11, { B: "Ønsker" });
  put(proj, 12, { B: "Epson EB-L1755U", G: "1200" });

  // Key fobs: A id or group heading, B holder.
  const fobs = wb.addWorksheet("Nøglebrikker");
  put(fobs, 1, { A: "Hovedindgang" });
  put(fobs, 2, { A: "U99901", B: "Alex" });
  put(fobs, 3, { A: "U99902", B: "MANGLER" });
  put(fobs, 4, { A: "U99903", B: `Bil ${marker}` });
  put(fobs, 5, { B: "Brikker programmeres hos viceværten" });

  // Loans: a title line, "n x what" lines, a price line.
  const loans = wb.addWorksheet("IGANGVÆRENDE UDLEJE");
  put(loans, 1, { A: `Lånt af Testperson ${marker} 12.10.21` });
  put(loans, 2, { A: "4 x EclGalleryProfile" });
  put(loans, 3, { A: "2 x True1 5m" });
  put(loans, 4, { A: "5500,- + moms" });

  // Stands: A category, B system, C variant, D weight, E total (no price column).
  const stands = wb.addWorksheet("Stativer & Support");
  put(stands, 3, { A: "Hvad", B: "Type", C: "Str.", D: "Vægt", E: "I alt" });
  put(stands, 4, { A: "Stativer" });
  put(stands, 5, { B: `16mm rustfri rods ${marker}` });
  put(stands, 6, { C: "150cm", E: "30" });
  put(stands, 7, { C: "200cm", E: "8" });

  // Rate tables: Standard in A/B (rows 5+), Theatre in E/F, Revised in J/K.
  const rates = wb.addWorksheet("lejefaktor");
  put(rates, 1, { A: "Vertigo Lejefaktor standart", E: "———— NY teater lejefaktor ————" });
  put(rates, 4, { A: "Antal dage", B: "Faktor", E: "Antal dageFaktor", J: "dage", K: "faktor" });
  put(rates, 5, { A: "1 dag", B: "1", E: "1 dag", F: "0.5", J: "1", K: "1" });
  put(rates, 6, { A: "2 dage", B: "1.5", E: "14 dage", F: "2.1", J: "2", K: "1,5" });
  put(rates, 7, { A: "5-7 dage", B: "2.7", E: "30 dage", F: "3.3", J: "10", K: "2,3" });
  put(rates, 10, { E: "efterfølgende dage +10% af 1. dags leje" });
  put(rates, 16, { A: "efterfølgende dage +10% af 1. dags leje" });
  put(rates, 17, { A: "Alle priser er excl. moms, fragt og forsikring" });

  // Truss: A code (description on the row below), B length, C qty, F day price, H list, I discount %, K net;
  // below row 55 the supplier quotes with the same columns plus L line total, J/L totals.
  const truss = wb.addWorksheet("Truss");
  put(truss, 3, { A: "Kode", B: "Længde", C: "Antal", F: "Pris/dag", H: "Liste", I: "Rabat", K: "Netto" });
  put(truss, 4, { A: `HD24-200 ${marker}`, B: "2", C: "8", F: "60", H: "3016", I: "40", K: "1809.6" });
  put(truss, 5, { A: "Box truss 2 m" });
  put(truss, 6, { A: `CS1-CON ${marker}`, C: "20", F: "2", H: "83", I: "40", K: "49.8" });
  put(truss, 7, { A: "Conical Connector" });
  put(truss, 57, { A: "Tilbud fra Urs Ordrebekræftelse 303053885 d. 23. juli 2025" });
  put(truss, 59, { A: `HD24-200 ${marker}`, C: "25", H: "3016", I: "40", K: "1809.6", L: "45240" });
  put(truss, 60, { A: "Box truss 2 m" });
  put(truss, 62, { A: `CS1-CON ${marker}`, C: "128", H: "83", I: "40", K: "49.8", L: "6374.4" });
  put(truss, 63, { A: "Conical Connector HD/FD" });
  put(truss, 65, { A: "40x40cm alu baseplate - mangler pris" });
  put(truss, 67, { A: "Pulver lakering - Truss", H: "18744", K: "18744", L: "18744" });
  put(truss, 70, { J: "Samlet", L: "70358.4" });
  put(truss, 71, { J: "Fakturarabatbeløb -7.035,84", L: "63322.56" });

  // Rods recount: A label, D count, heading rows without a count.
  const rods = wb.addWorksheet("16mm rods");
  put(rods, 1, { A: "16mm", B: "rustfri rods" });
  put(rods, 2, { A: "150cm", D: "31" });
  put(rods, 3, { A: "200cm", D: "8" });
  put(rods, 4, { A: "250cm", D: "2" });

  return wb;
}

export async function fixtureBytes(marker: string): Promise<Buffer> {
  const buf = await buildFixtureWorkbook(marker).xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
