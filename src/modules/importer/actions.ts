"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { errorState, type FormState } from "@/lib/forms";
import { importer } from "./service";

export async function uploadSpreadsheet(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("settings.manage");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, fieldErrors: { file: "Choose the .xlsx file." } };
  let id: string;
  try {
    id = await importer.stash(actor, Buffer.from(await file.arrayBuffer()), file.name);
  } catch (err) {
    return errorState(err);
  }
  redirect(`/settings/import/${id}`);
}

/** Applies the plan with the chosen decisions; the preview page then shows the recorded result. */
export async function confirmImport(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("settings.manage");
  const id = String(formData.get("id") ?? "");
  const decisions: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (k.startsWith("decision.")) decisions[k.slice(9)] = String(v);
  try {
    await importer.commit(actor, id, decisions);
  } catch (err) {
    return errorState(err);
  }
  revalidatePath("/inventory", "layout");
  revalidatePath("/rentals", "layout");
  revalidatePath("/settings/contacts");
  revalidatePath("/dashboard");
  redirect(`/settings/import/${id}`);
}
