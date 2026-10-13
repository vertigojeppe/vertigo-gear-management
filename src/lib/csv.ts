/**
 * CSV for spreadsheets. Semicolon-separated by default, because Danish
 * Excel splits on ";" and treats "," as the decimal mark; a UTF-8 byte
 * order mark so Excel reads æøå; CRLF line ends; every field quoted when
 * it contains the separator, a quote, or a line break. Dates become ISO
 * strings, booleans "yes"/"no" are left to the caller (pass strings).
 */
export type CsvColumn<T> = { key: string; header: string; value: (row: T) => unknown };

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[], sep = ";"): string {
  const lines = [columns.map((c) => cell(c.header, sep)).join(sep)];
  for (const r of rows) lines.push(columns.map((c) => cell(c.value(r), sep)).join(sep));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function cell(v: unknown, sep = ";"): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (v instanceof Date) s = Number.isNaN(v.getTime()) ? "" : v.toISOString();
  else if (typeof v === "number") s = Number.isFinite(v) ? String(v) : "";
  else if (typeof v === "boolean") s = v ? "true" : "false";
  else if (Array.isArray(v)) s = v.map((x) => (x === null || x === undefined ? "" : String(x))).join(", ");
  else if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  // A leading =, +, -, @ would be run as a formula by spreadsheets: neutralise it.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /["\r\n]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
}
