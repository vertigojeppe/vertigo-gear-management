"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { contactInput } from "./schema";
import { contacts } from "./service";

export async function saveContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("contacts.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(contactInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (id) await contacts.update(actor, id, parsed.data);
    else await contacts.create(actor, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath("/settings/contacts");
  revalidatePath("/inventory/locations");
  return { ok: true };
}

export async function deleteContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("contacts.write");
  try {
    await contacts.remove(actor, String(formData.get("id") ?? ""));
  } catch (err) {
    return errorState(err);
  }
  revalidatePath("/settings/contacts");
  return { ok: true };
}
