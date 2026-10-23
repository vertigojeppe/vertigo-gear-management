"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { customFieldDefinitionInput, webhookInput } from "./schema";
import { customFieldDefinitions, outboxAdmin, webhooks } from "./service";
import { glossary } from "./glossary";
import { appSettings } from "./app-settings";

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

/** Settings › Search words: replaces the whole list. */
export async function saveGlossary(_prev: FormState<{ count: number }>, formData: FormData): Promise<FormState<{ count: number }>> {
  const actor = await requirePermission("settings.manage");
  try {
    const { count } = await glossary.save(actor, String(formData.get("text") ?? ""));
    revalidatePath("/settings/search");
    return { ok: true, data: { count } };
  } catch (err) {
    const { error, fieldErrors, values } = errorState(err, echoValues(formData));
    return { ok: false, error, fieldErrors, values };
  }
}


/** Settings › Layout: the page layout for everyone. Every page re-renders with it. */
export async function saveLayout(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("settings.manage");
  try {
    await appSettings.setLayout(actor, String(formData.get("layout") ?? ""));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return errorState(err);
  }
}
