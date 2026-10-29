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
import { planSpecs, readSpecSheet, specUpdate, type CurrentModel, type Link, type ModelSpecPlan, type SpecPlan, type SpecRow } from "./specs";

/** models / fields: what changed; checked: every model the sheet covered, now stamped `specsCheckedAt`. */
export type SpecImportResult = { models: number; fields: number; checked: number };

const num = (v: { toNumber(): number } | number | null) => (v === null ? null : typeof v === "number" ? v : v.toNumber());

/** The models as they are now, in the planner's shape (also used by the spec lookup). */
export async function currentModels(ids: string[]): Promise<Map<string, CurrentModel>> {
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
        defs: applicableDefs(defs, m.categoryId).map((d) => ({ key: d.key, label: d.label, type: d.type })),
      },
    ]),
  );
}

/**
 * Writes one model's ticked changes (without `picked`, its fills) and the
 * activity row ("Specs from <from>: filled in …"). Returns how many fields
 * changed. Shared by the spec sheet and the spec lookup.
 */
export async function writeSpecRow(tx: Prisma.TransactionClient, actor: Actor, row: SpecRow, m: CurrentModel, p: ModelSpecPlan, picked: Set<string> | undefined, from: string, details: Record<string, unknown> = {}): Promise<number> {
  const { data, changes } = specUpdate(row, m, p, picked);
  if (!changes.length) return 0;
  await tx.model.update({ where: { id: m.id }, data: data as Prisma.ModelUpdateInput });
  const filled = changes.filter((c) => c.action === "fill").map((c) => c.field);
  const replaced = changes.filter((c) => c.action === "keep").map((c) => c.field);
  const parts = [filled.length ? `filled in ${filled.join(", ")}` : "", replaced.length ? `replaced ${replaced.join(", ")}` : ""].filter(Boolean);
  await logActivity(actor, { entityType: "model", entityId: m.id, action: "specs_imported", summary: `Specs from ${from}: ${parts.join("; ")}`, details: { changes, ...details } }, tx);
  return changes.length;
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

  /** `picks`: the preview's ticked changes (`pickKey`); without them, the fills. */
  async apply(actor: Actor, text: string, fileName: string, picks?: string[]): Promise<SpecImportResult> {
    assertCan(actor, "settings.manage");
    const sheet = readSpecSheet(text);
    if (sheet.errors.length) throw new ImportError(sheet.errors[0]);
    const current = await currentModels(sheet.rows.map((r) => r.id));
    const plan = planSpecs(sheet, current);
    if (plan.errors.length) throw new ImportError(plan.errors[0]);
    const picked = picks ? new Set(picks) : undefined;
    let models = 0;
    let fields = 0;
    const checkedAt = new Date();
    await prisma.$transaction(async (tx) => {
      for (const row of sheet.rows) {
        const m = current.get(row.id);
        const p = plan.models.find((x) => x.id === row.id);
        if (!m || !p) continue;
        const changed = await writeSpecRow(tx, actor, row, m, p, picked, fileName);
        if (!changed) continue;
        models++;
        fields += changed;
      }
      // Every model the sheet covered counts as checked, also when nothing changed (nothing found, or the values were declined).
      await tx.model.updateMany({ where: { id: { in: [...current.keys()] } }, data: { specsCheckedAt: checkedAt } });
      await logActivity(actor, { entityType: "settings", entityId: "import", action: "specs_imported", summary: `Spec sheet ${fileName}: ${fields} fields updated on ${models} models, ${current.size} models checked` }, tx);
    }, { timeout: 60_000 });
    return { models, fields, checked: current.size };
  },
};
