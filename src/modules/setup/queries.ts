import { prisma } from "@/lib/db";
import type { SetupCondition, SetupPhase } from "../../../config/app.config";
import { ruleEstimate, type SetupRule } from "./logic";

const num = (v: { toString(): string } | null) => (v === null ? null : Number(v));

export type InstallationTypeRow = SetupRule & { id: string; name: string; description: string | null; unitName: string | null; ruleNotes: string | null; records: number };

export type SetupRecordRow = {
  id: string;
  phase: SetupPhase;
  period: string | null;
  units: number | null;
  crew: number | null;
  hours: number;
  conditions: SetupCondition[];
  lesson: string | null;
  /** What the type's rule of thumb says for the same units and crew. */
  estimate: number | null;
};

function toType(t: Awaited<ReturnType<typeof prisma.installationType.findFirstOrThrow>>, records: number): InstallationTypeRow {
  return { id: t.id, name: t.name, description: t.description, baseHours: num(t.baseHours), minutesPerUnit: num(t.minutesPerUnit), unitName: t.unitName, ruleCrew: t.ruleCrew, ruleNotes: t.ruleNotes, records };
}

/** Every installation type, A–Z, with how many jobs are recorded. */
export async function installationTypeList(): Promise<InstallationTypeRow[]> {
  const rows = await prisma.installationType.findMany({ include: { _count: { select: { records: true } } } });
  return rows.map((t) => toType(t, t._count.records)).sort((a, b) => a.name.localeCompare(b.name, "da"));
}

/** One type with its records, newest first, each next to the rule's estimate. */
export async function installationTypeDetail(id: string): Promise<{ type: InstallationTypeRow; records: SetupRecordRow[] } | null> {
  const t = await prisma.installationType.findUnique({ where: { id }, include: { records: { orderBy: { createdAt: "desc" } } } });
  if (!t) return null;
  const type = toType(t, t.records.length);
  const records = t.records.map((r) => ({
    id: r.id,
    phase: r.phase as SetupPhase,
    period: r.period,
    units: r.units,
    crew: r.crew,
    hours: Number(r.hours),
    conditions: r.conditions as SetupCondition[],
    lesson: r.lesson,
    estimate: ruleEstimate(type, r.units, r.crew),
  }));
  return { type, records };
}
