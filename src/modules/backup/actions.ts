"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { errorState, type FormState } from "@/lib/forms";
import { backup, BackupError } from "./service";

export type RestoreState = FormState<{ tables: number; rows: number }>;

/** Settings › Backup › Restore: a JSON file plus the typed word "restore". */
export async function restoreBackup(_prev: RestoreState, formData: FormData): Promise<RestoreState> {
  const actor = await requirePermission("users.manage");
  if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== "restore") return { ok: false, fieldErrors: { confirm: "Type restore to confirm." } };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, fieldErrors: { file: "Choose the backup file." } };
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return { ok: false, fieldErrors: { file: "That file is not JSON." } };
  }
  try {
    const result = await backup.restore(actor, data);
    revalidatePath("/", "layout");
    return { ok: true, data: result };
  } catch (err) {
    if (err instanceof BackupError) return { ok: false, error: err.message };
    return errorState(err);
  }
}
