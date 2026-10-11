"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { customFieldDefinitionInput, webhookInput } from "./schema";
import { customFieldDefinitions, outboxAdmin, webhooks } from "./service";

export async function createCustomField(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("settings.manage");
  const parsed = parseForm(customFieldDefinitionInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await customFieldDefinitions.create(actor, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath("/settings/custom-fields");
  return { ok: true };
}

export async function updateCustomField(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("settings.manage");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(customFieldDefinitionInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await customFieldDefinitions.update(actor, id, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath("/settings/custom-fields");
  return { ok: true };
}

export async function deleteCustomField(formData: FormData): Promise<void> {
  const actor = await requirePermission("settings.manage");
  await customFieldDefinitions.remove(actor, String(formData.get("id")));
  revalidatePath("/settings/custom-fields");
}

/* Webhooks */

export async function saveWebhook(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("settings.manage");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(webhookInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (id) await webhooks.update(actor, id, parsed.data);
    else await webhooks.create(actor, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath("/settings/webhooks");
  return { ok: true };
}

export async function deleteWebhook(formData: FormData): Promise<void> {
  const actor = await requirePermission("settings.manage");
  await webhooks.remove(actor, String(formData.get("id")));
  revalidatePath("/settings/webhooks");
}

export async function retryOutboxRow(formData: FormData): Promise<void> {
  const actor = await requirePermission("settings.manage");
  await outboxAdmin.retry(actor, String(formData.get("id")));
  revalidatePath("/settings/webhooks");
}
