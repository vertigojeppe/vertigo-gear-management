"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { customFieldsFromForm, validateCustomFields, CF_PREFIX } from "@/lib/custom-fields";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { customFieldDefinitions } from "@/modules/settings";
// eslint-disable-next-line no-restricted-imports -- the wishlist barrel re-exports client components; the service is all this action needs
import { wishes } from "@/modules/wishlist/service";
import { categoryInput, itemBatchInput, itemInput, locationInput, modelInput, statusChangeInput, familyRenameInput } from "./schema";
import { categories, items, locations, models, InventoryError, type BulkResult } from "./service";

function revalidateInventory() {
  revalidatePath("/inventory", "layout");
  revalidatePath("/dashboard");
}

function prefixErrors(errors: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [CF_PREFIX + k, v]));
}

/* Categories ---------------------------------------------------------------- */

export async function saveCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(categoryInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (id) await categories.update(actor, id, parsed.data);
    else await categories.create(actor, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateInventory();
  return { ok: true };
}

export async function deleteCategory(formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  try {
    await categories.remove(actor, String(formData.get("id")));
  } catch (err) {
    return errorState(err);
  }
  revalidateInventory();
  return { ok: true };
}

/* Locations ----------------------------------------------------------------- */

export async function saveLocation(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(locationInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (id) await locations.update(actor, id, parsed.data);
    else await locations.create(actor, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateInventory();
  return { ok: true };
}

export async function deleteLocation(formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  try {
    await locations.remove(actor, String(formData.get("id")));
  } catch (err) {
    return errorState(err);
  }
  revalidateInventory();
  return { ok: true };
}

/* Models -------------------------------------------------------------------- */

export async function saveModel(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  const id = String(formData.get("id") ?? "");
  const wishId = String(formData.get("wishId") ?? "");
  const parsed = parseForm(modelInput, formData);
  if (!parsed.ok) return parsed.state;
  const defs = await customFieldDefinitions.forEntity("model", parsed.data.categoryId);
  const cf = validateCustomFields(defs, customFieldsFromForm(formData));
  if (!cf.ok) return { ok: false, fieldErrors: prefixErrors(cf.errors), values: echoValues(formData) };
  let modelId = id;
  try {
    if (id) await models.update(actor, id, parsed.data, cf.values);
    else {
      modelId = (await models.create(actor, parsed.data, cf.values)).id;
      // Converting a wish: the model exists now, so the wish is bought and points at it.
      if (wishId) await wishes.markBought(actor, wishId, modelId);
    }
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateInventory();
  revalidatePath("/inventory/wishlist");
  redirect(`/inventory/models/${modelId}`);
}

export async function renameFamily(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("users.manage");
  const modelId = String(formData.get("modelId") ?? "");
  const parsed = parseForm(familyRenameInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await models.renameFamily(actor, modelId, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateInventory();
  revalidatePath("/projects", "layout");
  revalidatePath("/rentals", "layout");
  return { ok: true };
}

export async function setModelArchived(formData: FormData): Promise<void> {
  const actor = await requirePermission("inventory.write");
  const id = String(formData.get("id"));
  await models.setArchived(actor, id, formData.get("archived") === "true");
  revalidateInventory();
  redirect(`/inventory/models/${id}`);
}

export async function deleteModel(formData: FormData): Promise<void> {
  const force = formData.get("force") === "on";
  const actor = await requirePermission(force ? "users.manage" : "inventory.write");
  const id = String(formData.get("id"));
  try {
    await models.remove(actor, id, { force });
  } catch (err) {
    if (err instanceof InventoryError) redirect(`/inventory/models/${id}?error=${encodeURIComponent(err.message)}`);
    throw err;
  }
  revalidateInventory();
  redirect("/inventory");
}

export type BulkState = FormState<BulkResult>;

/** Bulk bar on the inventory list: ids[] + op (archive | unarchive | delete | force-delete, the last with forceIds[]). */
export async function bulkModels(_prev: BulkState, formData: FormData): Promise<BulkState> {
  const op = String(formData.get("op") ?? "");
  const force = op === "force-delete";
  const actor = await requirePermission(force ? "users.manage" : "inventory.write");
  const ids = (force ? formData.getAll("forceIds") : formData.getAll("ids")).map(String);
  if (ids.length === 0) return { ok: false, error: "Select at least one model." };
  if (!["archive", "unarchive", "delete", "force-delete"].includes(op)) return { ok: false, error: "Unknown operation." };
  let result: BulkResult;
  try {
    result = await models.bulk(actor, ids, force ? "delete" : (op as "archive" | "unarchive" | "delete"), { force });
  } catch (err) {
    return errorState(err);
  }
  revalidateInventory();
  revalidatePath("/projects", "layout");
  revalidatePath("/rentals", "layout");
  // Models still in use stay on the page, so the list of refusals can be shown in place.
  if (result.refused.length > 0) return { ok: true, data: result };
  // Otherwise the rows just changed or vanished: reload the same view with the outcome in the URL.
  const returnTo = String(formData.get("returnTo") ?? "/inventory");
  const base = returnTo.startsWith("/inventory") ? returnTo.replace(/([?&])done=[^&]*/g, "$1").replace(/[?&]$/, "") : "/inventory";
  redirect(`${base}${base.includes("?") ? "&" : "?"}done=${result.op}:${result.done}`);
}

/* Items --------------------------------------------------------------------- */

export async function createItems(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  const parsed = parseForm(itemBatchInput, formData);
  if (!parsed.ok) return parsed.state;
  const defs = await customFieldDefinitions.forEntity("item", (await models.get(parsed.data.modelId))?.categoryId ?? null);
  const cf = validateCustomFields(defs, customFieldsFromForm(formData));
  if (!cf.ok) return { ok: false, fieldErrors: prefixErrors(cf.errors), values: echoValues(formData) };
  const { count, serialNumbers, ...input } = parsed.data;
  let created;
  try {
    created = await items.create(actor, input, {
      count,
      serialNumbers: serialNumbers ? serialNumbers.split(/\r?\n/).map((s) => s.trim()) : undefined,
      customFields: cf.values,
    });
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateInventory();
  if (created.length === 1) redirect(`/inventory/items/${created[0].id}`);
  redirect(`/inventory/models/${input.modelId}`);
}

export async function updateItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(itemInput, formData);
  if (!parsed.ok) return parsed.state;
  const defs = await customFieldDefinitions.forEntity("item", (await models.get(parsed.data.modelId))?.categoryId ?? null);
  const cf = validateCustomFields(defs, customFieldsFromForm(formData));
  if (!cf.ok) return { ok: false, fieldErrors: prefixErrors(cf.errors), values: echoValues(formData) };
  try {
    await items.update(actor, id, parsed.data, cf.values);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateInventory();
  redirect(`/inventory/items/${id}`);
}

export async function changeItemStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(statusChangeInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await items.changeStatus(actor, id, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateInventory();
  return { ok: true };
}

export async function moveItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("locationId") ?? "");
  try {
    await items.move(actor, id, raw && raw !== "__none__" ? raw : null);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateInventory();
  return { ok: true };
}

export async function addItemToKit(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("inventory.write");
  try {
    await items.addToKit(actor, String(formData.get("kitId")), String(formData.get("itemId")));
  } catch (err) {
    return errorState(err);
  }
  revalidateInventory();
  return { ok: true };
}

export async function removeItemFromKit(formData: FormData): Promise<void> {
  const actor = await requirePermission("inventory.write");
  const itemId = String(formData.get("itemId"));
  await items.removeFromKit(actor, itemId);
  revalidateInventory();
}

export async function deleteItem(formData: FormData): Promise<void> {
  const actor = await requirePermission("users.manage");
  const id = String(formData.get("id"));
  const modelId = String(formData.get("modelId") ?? "");
  await items.remove(actor, id);
  revalidateInventory();
  redirect(modelId ? `/inventory/models/${modelId}` : "/inventory/items");
}
