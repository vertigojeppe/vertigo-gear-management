"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { errorState, type FormState } from "@/lib/forms";
import { importer } from "./service";
import { decodeSheet, type SpecPlan } from "./specs";
import { specImport, type SpecImportResult } from "./specs-service";
import { specLookup, type LookupPreview } from "./lookup";

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
    const picks = formData.getAll("pick").map(String);
    const result = await specImport.apply(actor, String(formData.get("sheet") ?? ""), String(formData.get("fileName") ?? "spec sheet"), picks);
    revalidatePath("/inventory", "layout");
    return { ok: true, data: result };
  } catch (err) {
    const { error, fieldErrors } = errorState(err);
    return { ok: false, error, fieldErrors };
  }
}

/** Spec lookup on a model page: read the pasted link and plan the changes; nothing is written. */
export async function lookUpSpecs(_prev: FormState<LookupPreview>, formData: FormData): Promise<FormState<LookupPreview>> {
  const actor = await requirePermission("inventory.write");
  const url = String(formData.get("url") ?? "").trim();
  try {
    return { ok: true, data: await specLookup.preview(actor, String(formData.get("modelId") ?? ""), { url }), values: { url } };
  } catch (err) {
    const { error, fieldErrors } = errorState(err);
    return { ok: false, error, fieldErrors, values: { url } };
  }
}

/** Write the ticked findings of a lookup (planned again against the model as it is now). */
export async function applyLookedUpSpecs(_prev: FormState<{ fields: number; photo: boolean }>, formData: FormData): Promise<FormState<{ fields: number; photo: boolean }>> {
  const actor = await requirePermission("inventory.write");
  const modelId = String(formData.get("modelId") ?? "");
  try {
    let row: unknown = null;
    try {
      row = JSON.parse(String(formData.get("row") ?? "null"));
    } catch {
      /* rejected by the service */
    }
    const result = await specLookup.apply(actor, modelId, row, formData.getAll("pick").map(String), String(formData.get("from") ?? "a lookup"), { image: String(formData.get("image") ?? "") || undefined });
    revalidatePath(`/inventory/models/${modelId}`);
    revalidatePath("/inventory");
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
  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  redirect(`/settings/import/${id}`);
}
