import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import type { InstallationTypeInput, SetupRecordInput } from "./schema";

export class SetupError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "SetupError";
  }
}

function typeData(input: InstallationTypeInput) {
  return {
    name: input.name,
    description: input.description ?? null,
    baseHours: input.baseHours ?? null,
    minutesPerUnit: input.minutesPerUnit ?? null,
    unitName: input.unitName ?? null,
    ruleCrew: input.ruleCrew ?? null,
    ruleNotes: input.ruleNotes ?? null,
  };
}

async function assertNameFree(name: string, id?: string) {
  const clash = await prisma.installationType.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) } });
  if (clash) throw new SetupError(`There is already an installation type called ${clash.name}.`, "name");
}

/** Installation types with their rule of thumb (projects.write to change). */
export const installationTypes = {
  async create(actor: Actor, input: InstallationTypeInput) {
    assertCan(actor, "projects.write");
    await assertNameFree(input.name);
    const t = await prisma.installationType.create({ data: typeData(input) });
    await logActivity(actor, { entityType: "installation", entityId: t.id, action: "created", summary: `Created installation type "${t.name}"` });
    return t;
  },

  async update(actor: Actor, id: string, input: InstallationTypeInput) {
    assertCan(actor, "projects.write");
    await assertNameFree(input.name, id);
    const t = await prisma.installationType.update({ where: { id }, data: typeData(input) });
    await logActivity(actor, { entityType: "installation", entityId: t.id, action: "updated", summary: `Updated installation type "${t.name}"` });
    return t;
  },

  /** Refused while records point at it: they are the experience we keep. */
  async remove(actor: Actor, id: string) {
    assertCan(actor, "projects.write");
    const t = await prisma.installationType.findUniqueOrThrow({ where: { id }, include: { _count: { select: { records: true } } } });
    if (t._count.records > 0) throw new SetupError(`${t.name} has ${t._count.records} recorded jobs; remove those first.`);
    await prisma.installationType.delete({ where: { id } });
    await logActivity(actor, { entityType: "installation", entityId: id, action: "deleted", summary: `Deleted installation type "${t.name}"` });
  },
};

/** How long a build-up or pack-down took. */
export const setupRecords = {
  async create(actor: Actor, input: SetupRecordInput) {
    assertCan(actor, "projects.write");
    const type = await prisma.installationType.findUnique({ where: { id: input.typeId } });
    if (!type) throw new SetupError("Installation type not found.");
    const r = await prisma.setupRecord.create({
      data: { typeId: type.id, phase: input.phase, source: "memory", period: input.period ?? null, units: input.units ?? null, crew: input.crew ?? null, hours: input.hours, conditions: input.conditions, lesson: input.lesson ?? null },
    });
    await logActivity(actor, { entityType: "installation", entityId: type.id, action: "setup_recorded", summary: `${type.name}: recorded a ${input.phase === "pack" ? "pack-down" : "build-up"} of ${input.hours} h${input.period ? ` (${input.period})` : ""}` });
    return r;
  },

  async remove(actor: Actor, id: string) {
    assertCan(actor, "projects.write");
    const r = await prisma.setupRecord.findUniqueOrThrow({ where: { id }, include: { type: { select: { name: true } } } });
    await prisma.setupRecord.delete({ where: { id } });
    await logActivity(actor, { entityType: "installation", entityId: r.typeId, action: "setup_record_deleted", summary: `${r.type.name}: removed a recorded ${r.phase === "pack" ? "pack-down" : "build-up"} of ${Number(r.hours)} h` });
  },
};
