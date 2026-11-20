import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { installationTypes, setupRecords } from "../service";
import { installationTypeDetail, installationTypeList } from "../queries";

/** Installation types with a rule of thumb, remembered jobs compared with it, and who may change them. */
const marker = `setup-${Date.now()}`;
const member: Actor = { id: "", email: "", name: "Test Member", role: "member" };
const viewer: Actor = { id: "", email: "", name: "Test Viewer", role: "viewer" };
const ids: string[] = [];

afterAll(async () => {
  await prisma.setupRecord.deleteMany({ where: { typeId: { in: ids } } });
  await prisma.installationType.deleteMany({ where: { id: { in: ids } } });
  await prisma.activityLog.deleteMany({ where: { entityId: { in: ids } } });
  await prisma.$disconnect();
});

describe("setup times", () => {
  it("keeps a rule, compares remembered jobs with it, and protects them", async () => {
    member.id = viewer.id = (await prisma.user.findFirst({ where: { role: "member" } }))?.id ?? "";
    const input = { name: `Facade ${marker}`, description: undefined, baseHours: 3, minutesPerUnit: 30, unitName: "projector", ruleCrew: 3, ruleNotes: undefined };
    await expect(installationTypes.create(viewer, input)).rejects.toThrow();
    const type = await installationTypes.create(member, input);
    ids.push(type.id);
    await expect(installationTypes.create(member, { ...input, name: input.name.toUpperCase() })).rejects.toThrow(/already/);

    await setupRecords.create(member, { typeId: type.id, phase: "build", period: "Summer 2024", units: 8, crew: 3, hours: 9, conditions: ["outdoor", "weather"], lesson: "Wind slowed the lift work" });
    await setupRecords.create(member, { typeId: type.id, phase: "pack", period: undefined, units: undefined, crew: 4, hours: 2.5, conditions: [], lesson: undefined });

    const detail = (await installationTypeDetail(type.id))!;
    expect(detail.type).toMatchObject({ baseHours: 3, minutesPerUnit: 30, ruleCrew: 3, records: 2 });
    const build = detail.records.find((r) => r.phase === "build")!;
    expect(build).toMatchObject({ units: 8, crew: 3, hours: 9, estimate: 7, conditions: ["outdoor", "weather"] });
    expect(detail.records.find((r) => r.phase === "pack")!.estimate).toBeNull();
    expect((await installationTypeList()).find((t) => t.id === type.id)?.records).toBe(2);

    // Records keep the type; it goes only once they are gone.
    await expect(installationTypes.remove(member, type.id)).rejects.toThrow(/2 recorded jobs/);
    for (const r of detail.records) await setupRecords.remove(member, r.id);
    await installationTypes.remove(member, type.id);
    expect(await installationTypeDetail(type.id)).toBeNull();
  });
});
