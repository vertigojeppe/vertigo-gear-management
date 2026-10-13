"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { CF_PREFIX, customFieldsFromForm, validateCustomFields } from "@/lib/custom-fields";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { ConflictError, type AllocationLike } from "@/modules/projects";
import { customFieldDefinitions } from "@/modules/settings";
import { assignItemInput, rentalInput, rentalLineInput } from "./schema";
import { rentalLines, rentals } from "./service";

function revalidate(id?: string) {
  revalidatePath("/rentals", "layout");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/inventory", "layout");
  if (id) revalidatePath(`/rentals/${id}`);
}

export async function saveRental(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("rentals.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(rentalInput, formData);
  if (!parsed.ok) return parsed.state;
  const defs = await customFieldDefinitions.forEntity("rental");
  const cf = validateCustomFields(defs, customFieldsFromForm(formData));
  if (!cf.ok) return { ok: false, fieldErrors: Object.fromEntries(Object.entries(cf.errors).map(([k, v]) => [CF_PREFIX + k, v])), values: echoValues(formData) };
  let rentalId = id;
  try {
    if (id) await rentals.update(actor, id, parsed.data, cf.values);
    else rentalId = (await rentals.create(actor, parsed.data, cf.values)).id;
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidate(rentalId);
  redirect(`/rentals/${rentalId}`);
}

export async function markRentalOut(formData: FormData): Promise<void> {
  const actor = await requirePermission("rentals.write");
  const id = String(formData.get("id"));
  await rentals.markOut(actor, id);
  revalidate(id);
}

export async function markRentalReturned(formData: FormData): Promise<void> {
  const actor = await requirePermission("rentals.write");
  const id = String(formData.get("id"));
  await rentals.markReturned(actor, id);
  revalidate(id);
}

export async function deleteRental(formData: FormData): Promise<void> {
  const actor = await requirePermission("users.manage");
  await rentals.remove(actor, String(formData.get("id")));
  revalidate();
  redirect("/rentals");
}

export type LineState = FormState<{ conflict?: { available: number; requested: number; shortfall: number; notRentable?: number; conflicts: AllocationLike[] } }>;

export async function saveRentalLine(_prev: LineState, formData: FormData): Promise<LineState> {
  const actor = await requirePermission("rentals.write");
  const rentalId = String(formData.get("rentalId"));
  const lineId = String(formData.get("lineId") ?? "");
  const parsed = parseForm(rentalLineInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (lineId) await rentalLines.update(actor, lineId, parsed.data);
    else await rentalLines.add(actor, rentalId, parsed.data);
  } catch (err) {
    if (err instanceof ConflictError) {
      return { ok: false, values: echoValues(formData), data: { conflict: { available: err.check.available, requested: err.check.requested, shortfall: err.check.shortfall, notRentable: err.check.notRentable, conflicts: err.check.conflicts } } };
    }
    return errorState(err, echoValues(formData));
  }
  revalidate(rentalId);
  return { ok: true };
}

export async function assignRentalItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("rentals.write");
  const rentalId = String(formData.get("rentalId"));
  const lineId = String(formData.get("lineId"));
  const parsed = parseForm(assignItemInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await rentalLines.assignItem(actor, lineId, parsed.data.itemId ?? null);
  } catch (err) {
    return errorState(err);
  }
  revalidate(rentalId);
  return { ok: true };
}

export async function removeRentalLine(formData: FormData): Promise<void> {
  const actor = await requirePermission("rentals.write");
  await rentalLines.remove(actor, String(formData.get("id")));
  revalidate(String(formData.get("rentalId")));
}
