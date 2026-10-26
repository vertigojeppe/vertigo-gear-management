import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { items, models } from "../service";

/** Converting a model with items between serialized and bulk, against the dev database. */
const marker = `track-${Date.now().toString(36)}`;
const admin: Actor = { id: "", email: "", name: "Alex Admin", role: "admin" };
const member: Actor = { id: "", email: "", name: "Mette Member", role: "member" };
let categoryId = "";
let modelId = "";

beforeAll(async () => {
  admin.id = (await prisma.user.findFirstOrThrow({ where: { role: "admin" } })).id;
  member.id = admin.id;
  categoryId = (await prisma.category.create({ data: { name: `Cat ${marker}` } })).id;
  modelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Testlight", name: `Spot ${marker}`, trackingType: "serialized" } })).id;
  const units = await items.create(admin, { modelId, isKit: false } as never, { count: 3, serialNumbers: ["SN-1", "SN-2", "SN-3"] });
  // The last unit is in repair: it stays as its own row.
  await prisma.item.update({ where: { id: units[2].id }, data: { status: "in_repair" } });
});

afterAll(async () => {
  const ids = (await prisma.item.findMany({ where: { modelId }, select: { id: true } })).map((i) => i.id);
  await prisma.activityLog.deleteMany({ where: { entityId: { in: [...ids, modelId] } } });
  await prisma.item.deleteMany({ where: { modelId } });
  await prisma.model.deleteMany({ where: { id: modelId } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
});

describe("models.convertTracking", () => {
  it("is for admins only", async () => {
    await expect(models.convertTracking(member, modelId)).rejects.toThrow();
  });

  it("merges the units in house into one bin and leaves the one in repair alone", async () => {
    const before = await prisma.item.findMany({ where: { modelId }, orderBy: { assetTag: "asc" } });
    const result = await models.convertTracking(admin, modelId);
    expect(result.to).toBe("bulk");
    const after = await prisma.item.findMany({ where: { modelId }, orderBy: { assetTag: "asc" } });
    expect(after.map((i) => [i.assetTag, i.quantity, i.status, i.serialNumber])).toEqual([
      [before[0].assetTag, 2, "in_house", null],
      [before[2].assetTag, 1, "in_repair", "SN-3"],
    ]);
    expect((await prisma.model.findUniqueOrThrow({ where: { id: modelId } })).trackingType).toBe("bulk");
    const log = await prisma.activityLog.findFirst({ where: { entityId: modelId, action: "tracking_converted" } });
    expect(log?.summary).toContain(`merged into ${before[0].assetTag}`);
  });

  it("splits the bin back into units with new asset tags", async () => {
    const result = await models.convertTracking(admin, modelId);
    expect(result.to).toBe("serialized");
    expect(result.newTags).toHaveLength(1);
    const after = await prisma.item.findMany({ where: { modelId } });
    expect(after.map((i) => i.quantity)).toEqual([1, 1, 1]);
    expect(after.map((i) => i.assetTag)).toContain(result.newTags[0]);
    expect((await prisma.model.findUniqueOrThrow({ where: { id: modelId } })).trackingType).toBe("serialized");
  });
});
