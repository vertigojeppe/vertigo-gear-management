"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { errorState, type FormState } from "@/lib/forms";
import { importer } from "./service";
import { decodeSheet, type SpecPlan } from "./specs";
import { specImport, type SpecImportResult } from "./specs-service";

export type SpecPreviewData = { text: string; fileName: string; plan: SpecPlan };

/** Reads the spec sheet and returns the plan; nothing is written. The sheet's text travels back for the confirm form. */
export async function previewSpecs(_prev: FormState<SpecPreviewData>, formData: FormData): Promise<FormState<SpecPreviewData>> {
  const actor = await requirePermission("settings.manage");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, fieldErrors: { file: "Choose the .csv file." } };
  if (file.size > 5 * 1024 * 1024) return { ok: false, fieldErrors: { file: "The sheet is larger than 5 MB." } };
  try {
    const text = decodeSheet(new Uint8Array(await file.arrayBuffer()));
    return { ok: true, data: { text, fileName: file.name, plan: await specImport.preview(actor, text) } };
  } catch (err) {
    const { error, fieldErrors } = errorState(err);
    return { ok: false, error, fieldErrors };
  }
}

export async function applySpecs(_prev: FormState<SpecImportResult>, formData: FormData): Promise<FormState<SpecImportResult>> {
  const actor = await requirePermission("settings.manage");
  try {
    const result = await specImport.apply(actor, String(formData.get("sheet") ?? ""), String(formData.get("fileName") ?? "spec sheet"));
    revalidatePath("/inventory", "layout");
    return { ok: true, data: result };
  } catch (err) {
    const { error, fieldErrors } = errorState(err);
    return { ok: false, error, fieldErrors };
  }
}

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
