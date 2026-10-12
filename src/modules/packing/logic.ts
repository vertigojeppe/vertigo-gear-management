import { CHECK_OUTCOMES, type CheckOutcome, type PackingStatus } from "../../../config/app.config";

/**
 * Pure packing rules: progress per line, list totals, allowed transitions.
 * No database access, so these are unit-tested directly.
 */

export type CheckLike = { phase: "out" | "in"; quantity: number; outcome: string };

export type LineLike = {
  quantity: number;
  trackingType: "serialized" | "bulk";
  checks: CheckLike[];
};

export type LineProgress = {
  /** Units packed (out checks). */
  packed: number;
  /** Units still to pack. */
  toPack: number;
  /** Units returned ok / damaged / missing (in checks). */
  returnedOk: number;
  damaged: number;
  missing: number;
  /** Packed units with no check-in yet. */
  toReturn: number;
};

export function lineProgress(line: LineLike): LineProgress {
  const out = line.checks.filter((c) => c.phase === "out");
  const inn = line.checks.filter((c) => c.phase === "in");
  const packed = out.reduce((s, c) => s + c.quantity, 0);
  const returnedOk = inn.filter((c) => c.outcome === "ok").reduce((s, c) => s + c.quantity, 0);
  const damaged = inn.filter((c) => c.outcome === "damaged").reduce((s, c) => s + c.quantity, 0);
  const missing = inn.filter((c) => c.outcome === "missing").reduce((s, c) => s + c.quantity, 0);
  return {
    packed,
    toPack: Math.max(0, line.quantity - packed),
    returnedOk,
    damaged,
    missing,
    toReturn: Math.max(0, packed - returnedOk - damaged - missing),
  };
}

export function listProgress(lines: LineLike[]) {
  const totals = { units: 0, packed: 0, toPack: 0, returnedOk: 0, damaged: 0, missing: 0, toReturn: 0, linesComplete: 0 };
  for (const line of lines) {
    const p = lineProgress(line);
    totals.units += line.quantity;
    totals.packed += p.packed;
    totals.toPack += p.toPack;
    totals.returnedOk += p.returnedOk;
    totals.damaged += p.damaged;
    totals.missing += p.missing;
    totals.toReturn += p.toReturn;
    if (p.toPack === 0) totals.linesComplete++;
  }
  return totals;
}

/** Weight / power / case totals from the lines' models. */
export function listTotals(lines: { quantity: number; weightKg: number | null; powerDrawW: number | null; isCase: boolean; kitContentsWeightKg?: number; kitContentsPowerW?: number }[]) {
  let weightKg = 0;
  let powerW = 0;
  let cases = 0;
  let unknownWeight = 0;
  for (const l of lines) {
    if (l.weightKg === null) unknownWeight += l.quantity;
    else weightKg += l.weightKg * l.quantity;
    weightKg += (l.kitContentsWeightKg ?? 0) * l.quantity;
    powerW += ((l.powerDrawW ?? 0) + (l.kitContentsPowerW ?? 0)) * l.quantity;
    if (l.isCase) cases += l.quantity;
  }
  return { weightKg: Math.round(weightKg * 10) / 10, powerW, cases, unknownWeight };
}

/* Transitions */

export function canEditLines(status: PackingStatus): boolean {
  return status === "draft";
}
export function canPack(status: PackingStatus): boolean {
  return status === "draft";
}
export function canCheckOut(status: PackingStatus, progress: ReturnType<typeof listProgress>): boolean {
  return status === "draft" && progress.packed > 0;
}
export function canCheckIn(status: PackingStatus): boolean {
  return status === "checked_out";
}

export function outcomeItemStatus(outcome: CheckOutcome): string {
  return CHECK_OUTCOMES.find((o) => o.key === outcome)?.itemStatus ?? "in_house";
}

export function isOutcome(value: string): value is CheckOutcome {
  return CHECK_OUTCOMES.some((o) => o.key === value);
}
