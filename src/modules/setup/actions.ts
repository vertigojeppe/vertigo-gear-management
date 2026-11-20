"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { SETUP_CONDITIONS, type SetupCondition } from "../../../config/app.config";
import { installationTypeInput, setupRecordInput } from "./schema";
import { installationTypes, setupRecords } from "./service";

const LIST = "/projects/setup-times";

export async function saveInstallationType(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("projects.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(installationTypeInput, formData);
  if (!parsed.ok) return parsed.state;
  let typeId = id;
  try {
    if (id) await installationTypes.update(actor, id, parsed.data);
    else typeId = (await installationTypes.create(actor, parsed.data)).id;
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath(LIST, "layout");
  if (!id) redirect(`${LIST}/${typeId}`);
  return { ok: true };
}

export async function deleteInstallationType(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("projects.write");
  try {
    await installationTypes.remove(actor, String(formData.get("id")));
  } catch (err) {
    return errorState(err);
  }
  revalidatePath(LIST, "layout");
  redirect(LIST);
}

export async function addSetupRecord(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("projects.write");
  const parsed = parseForm(setupRecordInput, formData);
  if (!parsed.ok) return parsed.state;
  const conditions = formData.getAll("conditions").map(String).filter((c): c is SetupCondition => (SETUP_CONDITIONS as readonly string[]).includes(c));
  try {
    await setupRecords.create(actor, { ...parsed.data, conditions });
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath(LIST, "layout");
  return { ok: true };
}

export async function removeSetupRecord(formData: FormData): Promise<void> {
  const actor = await requirePermission("projects.write");
  await setupRecords.remove(actor, String(formData.get("id")));
  revalidatePath(LIST, "layout");
}
