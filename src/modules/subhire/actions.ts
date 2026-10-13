"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { subHireItemInput, subHireLineInput } from "./schema";
import { subHireItems, subHireLines } from "./service";

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/projects");
}

export async function saveSubHireItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(subHireItemInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (id) await subHireItems.update(actor, id, parsed.data);
    else await subHireItems.create(actor, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath("/inventory/subhire");
  return { ok: true };
}

export async function setSubHireItemArchived(formData: FormData): Promise<void> {
  const actor = await requirePermission("inventory.write");
  await subHireItems.setArchived(actor, String(formData.get("id") ?? ""), formData.get("archived") === "true");
  revalidatePath("/inventory/subhire");
}

export async function deleteSubHireItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  try {
    await subHireItems.remove(actor, String(formData.get("id") ?? ""));
  } catch (err) {
    return errorState(err);
  }
  revalidatePath("/inventory/subhire");
  return { ok: true };
}

export async function saveSubHireLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("projects.write");
  const projectId = String(formData.get("projectId") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  const parsed = parseForm(subHireLineInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (lineId) await subHireLines.update(actor, lineId, parsed.data);
    else await subHireLines.add(actor, projectId, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateProject(projectId);
  return { ok: true };
}

export async function removeSubHireLine(formData: FormData): Promise<void> {
  const actor = await requirePermission("projects.write");
  await subHireLines.remove(actor, String(formData.get("id") ?? ""));
  revalidateProject(String(formData.get("projectId") ?? ""));
}
