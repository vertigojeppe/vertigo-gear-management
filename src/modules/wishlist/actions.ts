"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { wishInput, wishStatusInput } from "./schema";
import { wishes } from "./service";

function revalidate() {
  revalidatePath("/inventory/wishlist");
  revalidatePath("/inventory");
}

export async function saveWish(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(wishInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (id) await wishes.update(actor, id, parsed.data);
    else await wishes.create(actor, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidate();
  return { ok: true };
}

export async function setWishStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  const parsed = parseForm(wishStatusInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await wishes.setStatus(actor, String(formData.get("id") ?? ""), parsed.data.status);
  } catch (err) {
    return errorState(err);
  }
  revalidate();
  return { ok: true };
}

export async function deleteWish(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  try {
    await wishes.remove(actor, String(formData.get("id") ?? ""));
  } catch (err) {
    return errorState(err);
  }
  revalidate();
  return { ok: true };
}

/** Dashboard button: put a running-low consumable on the wish list. */
export async function wishFromModel(formData: FormData): Promise<void> {
  const actor = await requirePermission("inventory.write");
  await wishes.fromModel(actor, String(formData.get("modelId") ?? ""), Number(formData.get("quantity") ?? 1));
  revalidatePath("/dashboard");
  revalidatePath("/inventory/wishlist");
}
