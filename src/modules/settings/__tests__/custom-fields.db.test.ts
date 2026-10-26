import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { customFieldDefinitions, SettingsError } from "../service";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { listModels } from "@/modules/inventory/queries";
// eslint-disable-next-line no-restricted-imports -- as above
import { modelFilters } from "@/modules/inventory/schema";

/** Category-scoped custom fields resolve through the category tree. */
const marker = `cf-${Date.now()}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
let parentId: string;
let childId: string;
let otherId: string;

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  parentId = (await prisma.category.create({ data: { name: `Parent ${marker}` } })).id;
  childId = (await prisma.category.create({ data: { name: `Child ${marker}`, parentId } })).id;
  otherId = (await prisma.category.create({ data: { name: `Other ${marker}` } })).id;
});

afterAll(async () => {
  await prisma.model.deleteMany({ where: { name: { contains: marker } } });
  await prisma.customFieldDefinition.deleteMany({ where: { key: { startsWith: `k_${marker.replace(/-/g, "_")}` } } });
  await prisma.category.deleteMany({ where: { id: { in: [childId, otherId, parentId] } } });
  await prisma.activityLog.deleteMany({ where: { summary: { contains: marker } } });
  await prisma.$disconnect();
});

describe("category-scoped custom fields", () => {
  const key = `k_${marker.replace(/-/g, "_")}`;
  const base = { entity: "model" as const, label: `Field ${marker}`, type: "text" as const, optionsText: undefined, required: false, showInList: false, sortOrder: 0 };

  it("applies to the category and its sub-categories only", async () => {
    await customFieldDefinitions.create(admin, { ...base, key, categoryId: parentId });
    const inParent = await customFieldDefinitions.forEntity("model", parentId);
    const inChild = await customFieldDefinitions.forEntity("model", childId);
    const inOther = await customFieldDefinitions.forEntity("model", otherId);
    expect(inParent.map((d) => d.key)).toContain(key);
    expect(inChild.map((d) => d.key)).toContain(key);
    expect(inOther.map((d) => d.key)).not.toContain(key);
    const all = await customFieldDefinitions.forEntity("model");
    expect(all.find((d) => d.key === key)?.categoryIds).toEqual(expect.arrayContaining([parentId, childId]));
  });

  it("allows the same key in another category but not twice in one", async () => {
    await customFieldDefinitions.create(admin, { ...base, key, categoryId: otherId });
    await expect(customFieldDefinitions.create(admin, { ...base, key, categoryId: otherId })).rejects.toBeInstanceOf(SettingsError);
  });

  it("shows a field marked for the list on the models of its category, as cell text", async () => {
    const listKey = `${key}_list`;
    await customFieldDefinitions.create(admin, { ...base, key: listKey, label: "Lumen", type: "number", categoryId: parentId, showInList: true });
    await customFieldDefinitions.create(admin, { ...base, key: `${key}_hidden`, label: "Firmware", categoryId: parentId });
    await prisma.model.create({ data: { categoryId: childId, manufacturer: "Testlight", name: `Beamer ${marker}`, customFields: { [listKey]: 3500, [`${key}_hidden`]: "v1.2" } } });
    const { families } = await listModels(modelFilters.parse({ q: `Beamer ${marker}` }));
    expect(families[0].variants[0].listFields).toEqual([{ key: listKey, text: "3.500 Lumen" }]);
  });
});
