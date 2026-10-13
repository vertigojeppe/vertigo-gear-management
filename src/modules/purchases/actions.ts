"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { purchaseInput } from "./schema";
import { purchases } from "./service";

function revalidate(modelId: string, purchaseId?: string) {
  revalidatePath(`/inventory/models/${modelId}`);
  if (purchaseId) revalidatePath(`/inventory/purchases/${purchaseId}`);
}

export async function savePurchase(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(purchaseInput, formData);
  if (!parsed.ok) return parsed.state;
  let modelId = parsed.data.modelId;
  try {
    if (id) modelId = (await purchases.update(actor, id, parsed.data)).modelId;
    else await purchases.create(actor, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidate(modelId, id || undefined);
  return { ok: true };
}

/** Plain form button; sends the user back to the model afterwards. */
export async function deletePurchase(formData: FormData): Promise<void> {
  const actor = await requirePermission("inventory.write");
  const id = String(formData.get("id") ?? "");
  const modelId = String(formData.get("modelId") ?? "");
  await purchases.remove(actor, id);
  revalidate(modelId, id);
  redirect(`/inventory/models/${modelId}`);
}
