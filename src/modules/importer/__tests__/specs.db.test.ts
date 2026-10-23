import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { specImport } from "../specs-service";

/**
 * Spec sheet import against the dev database: empty fields are filled,
 * a weight already on the model stays, links are appended, the model's
 * history records it, and a second run writes nothing.
 */
const M = `spec-${Date.now().toString(36)}`;
const admin: Actor = { id: "", email: "", name: "Alex Admin", role: "admin" };
let categoryId = "";
let modelId = "";

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  categoryId = (await prisma.category.create({ data: { name: `Stands ${M}` } })).id;
  modelId = (
    await prisma.model.create({
      data: { categoryId, manufacturer: "Testlight", name: `Stand ${M}`, weightKg: 30, links: [{ label: "Ours", url: "https://example.com/ours" }] },
    })
  ).id;
});

afterAll(async () => {
  await prisma.activityLog.deleteMany({ where: { OR: [{ entityId: modelId }, { action: "specs_imported", summary: { contains: M } }] } });
  await prisma.model.deleteMany({ where: { id: modelId } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
});

describe("specImport", () => {
  const sheet = () =>
    `Id;Weight (kg);Height (cm);Description;Links\n${modelId};32,5;366;"Min height: 156 cm\nPayload: 80 kg";"Product page | https://example.com/p"\nnot-a-model;1;;;\n`;

  it("previews fills, kept values and unknown ids without writing", async () => {
    const plan = await specImport.preview(admin, sheet());
    expect(plan.unknownIds).toEqual([{ line: 3, id: "not-a-model" }]); // rows as Excel numbers them: the description cell spans two lines
    expect(plan.models[0].changes.map((c) => [c.field, c.action])).toEqual([
      ["weightKg", "keep"],
      ["heightCm", "fill"],
      ["description", "fill"],
      ["links", "fill"],
    ]);
    expect((await prisma.model.findUniqueOrThrow({ where: { id: modelId } })).heightCm).toBeNull();
  });

  it("fills only empty fields and records it on the model", async () => {
    expect(await specImport.apply(admin, sheet(), `${M}.csv`)).toEqual({ models: 1, fields: 3 });
    const m = await prisma.model.findUniqueOrThrow({ where: { id: modelId } });
    expect(m.weightKg?.toNumber()).toBe(30);
    expect(m.heightCm?.toNumber()).toBe(366);
    expect(m.description).toBe("Min height: 156 cm\nPayload: 80 kg");
    expect(m.links).toEqual([
      { label: "Ours", url: "https://example.com/ours" },
      { label: "Product page", url: "https://example.com/p" },
    ]);
    const log = await prisma.activityLog.findFirst({ where: { entityType: "model", entityId: modelId, action: "specs_imported" } });
    expect(log?.summary).toBe(`Specs filled in from ${M}.csv: heightCm, description, links`);
  });

  it("writes nothing the second time", async () => {
    expect(await specImport.apply(admin, sheet(), `${M}.csv`)).toEqual({ models: 0, fields: 0 });
  });

  it("refuses a sheet with a bad number", async () => {
    await expect(specImport.apply(admin, `Id;Weight (kg)\n${modelId};heavy\n`, `${M}.csv`)).rejects.toThrow(/Row 2/);
  });
});
