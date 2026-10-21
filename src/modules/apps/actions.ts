"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { appInput, appVersionInput } from "./schema";
import { apps } from "./service";

/** New app → its page (to upload the first version); edit → stays. */
export async function saveApp(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("apps.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(appInput, formData);
  if (!parsed.ok) return parsed.state;
  let createdId: string | null = null;
  try {
    if (id) await apps.update(actor, id, parsed.data);
    else createdId = (await apps.create(actor, parsed.data)).id;
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath("/apps", "layout");
  if (createdId) redirect(`/apps/${createdId}`);
  return { ok: true };
}

/** After a chunked upload: attach the file as a new version. */
export async function addAppVersion(input: { appId: string; fileId: string; label?: string; notes?: string }): Promise<{ ok: boolean; error?: string }> {
  const actor = await requirePermission("apps.write");
  const parsed = appVersionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Something is missing. Try again." };
  try {
    await apps.addVersion(actor, parsed.data);
  } catch (err) {
    return { ok: false, error: errorState(err).error ?? "Could not add the version." };
  }
  revalidatePath("/apps", "layout");
  return { ok: true };
}

export async function setAppArchived(formData: FormData): Promise<void> {
  const actor = await requirePermission("apps.write");
  const id = String(formData.get("id") ?? "");
  await apps.setArchived(actor, id, formData.get("archived") === "true");
  revalidatePath("/apps", "layout");
}

/** Admin. */
export async function deleteAppVersion(formData: FormData): Promise<void> {
  const actor = await requirePermission("users.manage");
  await apps.removeVersion(actor, String(formData.get("id") ?? ""));
  revalidatePath("/apps", "layout");
}

/** Admin. */
export async function deleteApp(formData: FormData): Promise<void> {
  const actor = await requirePermission("users.manage");
  await apps.remove(actor, String(formData.get("id") ?? ""));
  revalidatePath("/apps", "layout");
  redirect("/apps");
}
