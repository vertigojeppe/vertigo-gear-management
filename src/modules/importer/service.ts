import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";
import { applyOps, type CommitResult } from "./commit";
import { readWorkbook } from "./parse";
import { buildPlan, modelKey, resolveOps, type Plan, type PlanContext } from "./plan";

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

const KEY_RE = /^[a-z0-9]{10,40}$/;
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type ImportDone = { fileName: string; at: string; result: CommitResult };

/**
 * Spreadsheet import. The uploaded workbook waits in storage as
 * imports/<id>.xlsx between the preview and the confirmation, so the plan
 * is rebuilt from the same bytes with the decisions applied. After a
 * successful import the workbook is deleted and imports/<id>.done keeps
 * the result, which the preview page shows instead of the plan.
 */
export const importer = {
  async stash(actor: Actor, bytes: Buffer, fileName: string): Promise<string> {
    assertCan(actor, "settings.manage");
    if (bytes.length === 0) throw new ImportError("Choose a spreadsheet.");
    if (bytes.length > 24 * 1024 * 1024) throw new ImportError("The spreadsheet is larger than 24 MB.");
    try {
      await readWorkbook(bytes, fileName);
    } catch {
      throw new ImportError("That file is not an .xlsx workbook.");
    }
    const id = createId();
    const storage = getStorage();
    await storage.put(`imports/${id}.xlsx`, bytes, XLSX);
    await storage.put(`imports/${id}.name`, Buffer.from(fileName, "utf8"), "text/plain");
    return id;
  },

  async context(): Promise<PlanContext> {
    const [models, items, users] = await Promise.all([
      prisma.model.findMany({ select: { manufacturer: true, name: true, variant: true } }),
      prisma.item.findMany({ select: { assetTag: true } }),
      prisma.user.findMany({ where: { active: true }, select: { id: true, name: true } }),
    ]);
    return { existingModels: new Set(models.map((m) => modelKey(m.name, m.variant))), existingTags: new Set(items.map((i) => i.assetTag)), users };
  },

  /** The recorded result when this import has already been applied. */
  async done(actor: Actor, id: string): Promise<ImportDone | null> {
    assertCan(actor, "settings.manage");
    if (!KEY_RE.test(id)) throw new ImportError("Unknown import.");
    const storage = getStorage();
    if (!(await storage.exists(`imports/${id}.done`))) return null;
    return JSON.parse((await storage.get(`imports/${id}.done`)).toString("utf8")) as ImportDone;
  },

  async plan(actor: Actor, id: string): Promise<Plan> {
    assertCan(actor, "settings.manage");
    if (!KEY_RE.test(id)) throw new ImportError("Unknown import.");
    const storage = getStorage();
    if (!(await storage.exists(`imports/${id}.xlsx`))) throw new ImportError("This import has expired or was already applied. Upload the spreadsheet again.");
    const bytes = await storage.get(`imports/${id}.xlsx`);
    const name = (await storage.exists(`imports/${id}.name`)) ? (await storage.get(`imports/${id}.name`)).toString("utf8") : "spreadsheet.xlsx";
    const wb = await readWorkbook(bytes, name);
    return buildPlan(wb, await importer.context());
  },

  async commit(actor: Actor, id: string, decisions: Record<string, string>): Promise<CommitResult> {
    assertCan(actor, "settings.manage");
    const plan = await importer.plan(actor, id);
    const ops = resolveOps(plan, decisions);
    const result = await applyOps(actor, ops, plan.fileName);
    const storage = getStorage();
    const done: ImportDone = { fileName: plan.fileName, at: new Date().toISOString(), result };
    await storage.put(`imports/${id}.done`, Buffer.from(JSON.stringify(done), "utf8"), "application/json");
    await storage.delete(`imports/${id}.xlsx`);
    await storage.delete(`imports/${id}.name`);
    return result;
  },
};
