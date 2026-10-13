import { LABEL_SIZES, type LabelSizeKey } from "../../../config/app.config";

/**
 * Pure geometry for label PDFs. A sheet size (Avery) is a grid centred on
 * its page; a "single" size is one label per page (thermal printers take
 * a roll of them). Everything is in millimetres here and converted to
 * points by the renderer.
 */
export type LabelSize = (typeof LABEL_SIZES)[number];
export type Cell = { page: number; index: number; xMm: number; yMm: number };

const PAGES_MM: Record<string, { w: number; h: number }> = { A4: { w: 210, h: 297 } };

export function labelSize(key: string): LabelSize {
  return LABEL_SIZES.find((s) => s.key === key) ?? LABEL_SIZES[0];
}

export function isLabelSizeKey(key: string): key is LabelSizeKey {
  return LABEL_SIZES.some((s) => s.key === key);
}

/** Page dimensions in mm: the sheet's page, or the label itself for single labels. */
export function pageMm(size: LabelSize): { w: number; h: number } {
  return size.page === "single" ? { w: size.widthMm, h: size.heightMm } : PAGES_MM[size.page];
}

export function perPage(size: LabelSize): number {
  return size.columns * size.rows;
}

/**
 * Where label number `n` (0-based, after `offset` skipped cells on the
 * first sheet) sits: page number and top-left corner. The grid is centred
 * on the page with the configured gaps, which matches Avery's own margins
 * for the sheets in app.config.
 */
export function cellFor(size: LabelSize, n: number, offset = 0): Cell {
  const per = perPage(size);
  const slot = n + Math.max(0, offset);
  const page = Math.floor(slot / per);
  const index = slot % per;
  const col = index % size.columns;
  const row = Math.floor(index / size.columns);
  const { w, h } = pageMm(size);
  const gapX = size.gapXMm ?? 0;
  const gapY = size.gapYMm ?? 0;
  const gridW = size.columns * size.widthMm + (size.columns - 1) * gapX;
  const gridH = size.rows * size.heightMm + (size.rows - 1) * gapY;
  const left = (w - gridW) / 2;
  const top = (h - gridH) / 2;
  return { page, index, xMm: round(left + col * (size.widthMm + gapX)), yMm: round(top + row * (size.heightMm + gapY)) };
}

/** Pages needed for `count` labels with `offset` skipped on the first. */
export function pageCount(size: LabelSize, count: number, offset = 0): number {
  if (count <= 0) return 0;
  return Math.floor((count + Math.max(0, offset) - 1) / perPage(size)) + 1;
}

export const MM = 72 / 25.4;
export function mm(v: number): number {
  return round(v * MM);
}
function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
