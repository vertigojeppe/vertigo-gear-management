import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { appConfig } from "../../../config/app.config";
import { NULLABLE_JSON, TABLES, sortSelfRefs, validateBackup, type BackupFile } from "./tables";

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

const CHUNK = 500;

type Delegate = { findMany(args?: unknown): Promise<Record<string, unknown>[]>; deleteMany(): Promise<unknown>; createMany(args: { data: Record<string, unknown>[] }): Promise<unknown> };
const delegate = (tx: unknown, name: string): Delegate => (tx as Record<string, Delegate>)[name];

/**
 * Whole-database backup as one JSON document, and the restore that
 * replaces the database with it. Uploaded files are not inside (they are
 * on the uploads volume; scripts/backup.sh takes both). A restore runs in
 * one transaction: either everything is swapped or nothing is.
 */
export const backup = {
  async export(actor: Actor): Promise<BackupFile> {
    assertCan(actor, "users.manage");
    const tables: BackupFile["tables"] = {};
    for (const t of TABLES) tables[t.name] = await delegate(prisma, t.delegate).findMany({ orderBy: { [t.idField ?? "id"]: "asc" } });
    return { version: 1, app: appConfig.name, exportedAt: new Date().toISOString(), tables };
  },

  async restore(actor: Actor, data: unknown): Promise<{ tables: number; rows: number }> {
    assertCan(actor, "users.manage");
    const problems = validateBackup(data);
    if (problems.length) throw new BackupError(problems.join(" "));
    const file = data as BackupFile;
    let rows = 0;
    await prisma.$transaction(
      async (tx) => {
        for (const t of [...TABLES].reverse()) await delegate(tx, t.delegate).deleteMany();
        for (const t of TABLES) {
          let list = (file.tables[t.name] ?? []) as Record<string, unknown>[];
          if (t.selfRef) list = sortSelfRefs(list, t.selfRef);
          const nullable = NULLABLE_JSON[t.name] ?? [];
          list = list.map((r) => {
            const row = { ...r };
            for (const col of nullable) if (row[col] === null) row[col] = Prisma.DbNull;
            return row;
          });
          for (let i = 0; i < list.length; i += CHUNK) await delegate(tx, t.delegate).createMany({ data: list.slice(i, i + CHUNK) });
          rows += list.length;
        }
        await logActivity(actor, { entityType: "settings", entityId: "backup", action: "restored", summary: `Restored a backup from ${file.exportedAt} (${rows} rows in ${TABLES.length} tables)` }, tx);
      },
      { timeout: 600_000, maxWait: 20_000 },
    );
    return { tables: TABLES.length, rows };
  },
};
