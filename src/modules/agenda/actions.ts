"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import type { GuestChoice } from "./logic";
import { googleGuests, guestDirectory } from "./queries";
import { entryInput } from "./schema";
import { entries } from "./service";

function refresh(projectId?: string | null) {
  revalidatePath("/calendar", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/board");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

/** Addresses for the Guests field's suggestions, fetched once when the field is first used. */
export async function guestSuggestions(): Promise<GuestChoice[]> {
  await requirePermission("agenda.write");
  return guestDirectory();
}

/** Guest suggestions from the signed-in person's Google contacts, mailbox and directory, while they type. */
export async function googleGuestSuggestions(query: string): Promise<GuestChoice[]> {
  const actor = await requirePermission("agenda.write");
  return googleGuests(actor.id, String(query).slice(0, 100));
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
