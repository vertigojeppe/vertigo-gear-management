import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { applicableDefs } from "@/lib/custom-fields";
import { modelLabelWithMaker } from "@/lib/format";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { customFieldDefinitions } from "@/modules/settings/service";
import { ImportError } from "./service";
import { planSpecs, readSpecSheet, specUpdate, type CurrentModel, type Link, type SpecPlan } from "./specs";

export type SpecImportResult = { models: number; fields: number };

const num = (v: { toNumber(): number } | number | null) => (v === null ? null : typeof v === "number" ? v : v.toNumber());

async function currentModels(ids: string[]): Promise<Map<string, CurrentModel>> {
  const [rows, defs] = await Promise.all([prisma.model.findMany({ where: { id: { in: ids } } }), customFieldDefinitions.forEntity("model")]);
  return new Map(
    rows.map((m) => [
      m.id,
      {
        id: m.id,
        label: modelLabelWithMaker(m),
        numbers: { weightKg: num(m.weightKg), widthCm: num(m.widthCm), heightCm: num(m.heightCm), depthCm: num(m.depthCm), powerDrawW: m.powerDrawW },
        description: m.description,
        links: Array.isArray(m.links) ? (m.links as Link[]) : [],
        customFields: (m.customFields ?? {}) as Record<string, unknown>,
        customKeys: applicableDefs(defs, m.categoryId).map((d) => d.key),
      },
    ]),
  );
}

/**
 * Spec sheet import (Settings › Import › Specs). The preview and the
 * apply both plan against the models as they are now, so a model edited
 * in between keeps its new values.
 */
export const specImport = {
  async preview(actor: Actor, text: string): Promise<SpecPlan> {
    assertCan(actor, "settings.manage");
    const sheet = readSpecSheet(text);
    return planSpecs(sheet, await currentModels(sheet.rows.map((r) => r.id)));
  },

  async apply(actor: Actor, text: string, fileName: string): Promise<SpecImportResult> {
    assertCan(actor, "settings.manage");
    const sheet = readSpecSheet(text);
    if (sheet.errors.length) throw new ImportError(sheet.errors[0]);
    const current = await currentModels(sheet.rows.map((r) => r.id));
    const plan = planSpecs(sheet, current);
    let models = 0;
    let fields = 0;
    await prisma.$transaction(async (tx) => {
      for (const row of sheet.rows) {
        const m = current.get(row.id);
        const p = plan.models.find((x) => x.id === row.id);
        if (!m || !p) continue;
        const { data, fields: filled } = specUpdate(row, m, p);
        if (!filled.length) continue;
        await tx.model.update({ where: { id: m.id }, data: data as Prisma.ModelUpdateInput });
        await logActivity(
          actor,
          { entityType: "model", entityId: m.id, action: "specs_imported", summary: `Specs filled in from ${fileName}: ${filled.join(", ")}`, details: { changes: p.changes.filter((c) => c.action === "fill") } },
          tx,
        );
        models++;
        fields += filled.length;
      }
      await logActivity(actor, { entityType: "settings", entityId: "import", action: "specs_imported", summary: `Spec sheet ${fileName}: ${fields} fields filled in on ${models} models` }, tx);
    }, { timeout: 60_000 });
    return { models, fields };
  },
};
