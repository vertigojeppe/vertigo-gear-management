import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { pathNames } from "@/modules/inventory/tree";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { customFieldDefinitions } from "@/modules/settings/service";
import { configuredExtractor, toSpecRow, type SpecExtractor } from "./lookup-extract";
import { linkSource, LookupError, type SpecSource } from "./lookup-source";
import { planSpecs, type ModelSpecPlan, type SpecRow } from "./specs";
import { currentModels, writeSpecRow } from "./specs-service";

/**
 * Spec lookup for one model: a source finds documents (today the link the
 * user pastes), an extractor reads the specs out of them (today Gemini),
 * and the result is planned and applied like a one-row spec sheet, so the
 * review, the ticks and the activity row are the same. Swapping in a
 * searching source or another provider only changes the `deps`.
 */
export type LookupDeps = { source?: SpecSource; extractor?: SpecExtractor | null };

export type LookupPreview = {
  modelId: string;
  /** What the extractor found, as a spec row; travels back with the ticks. */
  row: SpecRow;
  plan: ModelSpecPlan;
  /** Quote from the document per field (row field or extra field key). */
  evidence: Record<string, string>;
  sources: { title: string; url: string }[];
  matchesModel: boolean;
  product: string;
  notes: string;
  extractor: string;
};

const rowSchema = z.object({
  line: z.number(),
  id: z.string(),
  numbers: z.record(z.string(), z.number()),
  extra: z.record(z.string(), z.string()),
  description: z.string().optional(),
  links: z.array(z.object({ label: z.string().max(100), url: z.string().url() })).max(20),
});

/** Is spec lookup set up on this server (an extractor with its key)? */
export function specLookupAvailable(): boolean {
  return configuredExtractor() !== null;
}

/** The model, its category path, and the extra fields of its category with their options (a select's answer must be one of them). */
async function modelContext(modelId: string) {
  const m = await prisma.model.findUnique({ where: { id: modelId }, select: { id: true, manufacturer: true, name: true, variant: true, categoryId: true } });
  if (!m) throw new LookupError("Model not found.");
  const [current, cats, defs] = await Promise.all([currentModels([modelId]), prisma.category.findMany({ select: { id: true, name: true, parentId: true } }), customFieldDefinitions.forEntity("model", m.categoryId)]);
  return { m, current: current.get(modelId)!, category: pathNames(cats, m.categoryId).join(" › "), defs: defs.map((d) => ({ key: d.key, label: d.label, type: d.type, options: d.options })) };
}

export const specLookup = {
  /** Read the documents, extract, and plan the changes against the model as it is now. Nothing is written. */
  async preview(actor: Actor, modelId: string, input: { url?: string }, deps: LookupDeps = {}): Promise<LookupPreview> {
    assertCan(actor, "inventory.write");
    const extractor = deps.extractor === undefined ? configuredExtractor() : deps.extractor;
    if (!extractor) throw new LookupError("Spec lookup is not set up on this server (GEMINI_API_KEY).");
    const { m, current, category, defs } = await modelContext(modelId);
    const gathered = await (deps.source ?? linkSource()).gather({ manufacturer: m.manufacturer, name: m.name, variant: m.variant, url: input.url });
    const extraction = await extractor.extract({ model: { manufacturer: m.manufacturer, name: m.name, variant: m.variant, category, defs }, documents: gathered.documents });
    const { row, evidence } = toSpecRow(modelId, extraction, defs);
    row.links = gathered.links;
    const plan = planSpecs({ rows: [row], errors: [] }, new Map([[modelId, current]])).models[0] ?? { id: modelId, label: current.label, changes: [] };
    return {
      modelId,
      row,
      plan,
      evidence,
      sources: gathered.documents.map((d) => ({ title: d.title, url: d.url })),
      matchesModel: extraction.matchesModel,
      product: extraction.product,
      notes: extraction.notes,
      extractor: extractor.name,
    };
  },

  /** Write the ticked changes (planned again against the model as it is now) and stamp `specsCheckedAt`. */
  async apply(actor: Actor, modelId: string, rawRow: unknown, picks: string[], from: string): Promise<{ fields: number }> {
    assertCan(actor, "inventory.write");
    const parsed = rowSchema.safeParse(rawRow);
    if (!parsed.success || parsed.data.id !== modelId) throw new LookupError("The lookup could not be read. Look it up again.");
    const row = parsed.data as SpecRow;
    const current = (await currentModels([modelId])).get(modelId);
    if (!current) throw new LookupError("Model not found.");
    const plan = planSpecs({ rows: [row], errors: [] }, new Map([[modelId, current]])).models[0];
    let fields = 0;
    await prisma.$transaction(async (tx) => {
      if (plan) fields = await writeSpecRow(tx, actor, row, current, plan, new Set(picks), from, { lookup: true });
      await tx.model.update({ where: { id: modelId }, data: { specsCheckedAt: new Date() } });
    });
    return { fields };
  },
};
