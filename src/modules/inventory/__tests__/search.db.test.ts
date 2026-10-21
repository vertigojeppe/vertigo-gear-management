import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { listModels } from "../queries";
// eslint-disable-next-line no-restricted-imports -- the barrel loads server actions, which do not load under Vitest
import { listProjects } from "@/modules/projects/queries";

/**
 * The lists search forgivingly: spaces and case never matter, and a typo
 * still finds the row (flagged as a close match). Runs against the dev/CI
 * database with a unique marker word.
 */
const marker = `srch${Date.now().toString(36)}`;
let categoryId: string;
let modelId: string;
let projectId: string;
let worklightId: string;

beforeAll(async () => {
  categoryId = (await prisma.category.create({ data: { name: `Cat ${marker}` } })).id;
  modelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Showtec", name: `Q Base ${marker}`, trackingType: "serialized" } })).id;
  projectId = (await prisma.project.create({ data: { name: `Kulturnat ${marker}`, status: "quote", venueName: "Den Sorte Diamant" } })).id;
  worklightId = (await prisma.model.create({ data: { categoryId, manufacturer: "", name: `Worklight LED ${marker}`, trackingType: "serialized" } })).id;
});

afterAll(async () => {
  await prisma.project.delete({ where: { id: projectId } });
  await prisma.model.deleteMany({ where: { id: { in: [modelId, worklightId] } } });
  await prisma.category.delete({ where: { id: categoryId } });
  await prisma.$disconnect();
});

const page = { page: 1, archived: false } as const;
const typo = `x${marker.slice(1)}`;

describe("forgiving list search", () => {
  it("finds a model however the spaces fall", async () => {
    for (const q of [`qbase${marker}`, `Q BASE ${marker}`, `showtec qbase ${marker}`, `${marker} q-base`]) {
      const r = await listModels({ ...page, q });
      expect(r.families.flatMap((f) => f.variants.map((v) => v.id))).toContain(modelId);
      expect(r.closeMatches).toBe(false);
    }
  });

  it("finds it with a typo, as a close match", async () => {
    const r = await listModels({ ...page, q: `qbase ${typo}` });
    expect(r.families.flatMap((f) => f.variants.map((v) => v.id))).toEqual([modelId]);
    expect(r.closeMatches).toBe(true);
  });

  it("searches projects by name and venue the same way", async () => {
    const exact = await listProjects({ page: 1, when: "all", q: `sortediamant ${marker}` });
    expect(exact.rows.map((p) => p.id)).toEqual([projectId]);
    expect(exact.closeMatches).toBe(false);
    const close = await listProjects({ page: 1, when: "all", q: `kulturnatt ${typo}` });
    expect(close.rows.map((p) => p.id)).toEqual([projectId]);
    expect(close.closeMatches).toBe(true);
  });

  it("finds a model through the search words (seeded: arbejdslys = worklight)", async () => {
    const r = await listModels({ ...page, q: `arbejdslys ${marker}` });
    expect(r.families.flatMap((f) => f.variants.map((v) => v.id))).toEqual([worklightId]);
    expect(r.closeMatches).toBe(false);
  });
});
