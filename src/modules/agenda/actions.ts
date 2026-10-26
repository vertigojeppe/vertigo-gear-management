"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { entryInput } from "./schema";
import { entries } from "./service";

function refresh(projectId?: string | null) {
  revalidatePath("/calendar", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/board");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

/** New or changed calendar entry (meeting, time off, assignment); the people come as checkboxes named "people". */
export async function saveEntry(_prev: FormState<{ id: string }>, formData: FormData): Promise<FormState<{ id: string }>> {
  const actor = await requirePermission("agenda.write");
  const parsed = parseForm(entryInput, formData);
  if (!parsed.ok) return parsed.state;
  const people = formData.getAll("people").map(String);
  const id = String(formData.get("id") ?? "");
  try {
    const saved = id ? (await entries.update(actor, id, parsed.data, people), id) : await entries.create(actor, parsed.data, people);
    refresh(parsed.data.projectId);
    return { ok: true, data: { id: saved } };
  } catch (err) {
    const { error, fieldErrors } = errorState(err, echoValues(formData));
    return { ok: false, error, fieldErrors, values: echoValues(formData) };
  }
}

export async function deleteEntry(formData: FormData): Promise<void> {
  const actor = await requirePermission("agenda.write");
  await entries.remove(actor, String(formData.get("id") ?? ""));
  refresh(String(formData.get("projectId") ?? "") || null);
  redirect(String(formData.get("returnTo") ?? "/calendar"));
}
