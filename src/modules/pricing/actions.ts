"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { parseTiers } from "./engine";
import { extraLineInput, quoteSettingsInput, rateTableInput } from "./schema";
import { extraLines, quotes, rateTables, type HolderKind } from "./service";

function holderFrom(formData: FormData): { kind: HolderKind; id: string } {
  const kind = String(formData.get("holderKind")) === "rental" ? "rental" : "project";
  return { kind, id: String(formData.get("holderId") ?? "") };
}

function revalidateHolder(h: { kind: HolderKind; id: string }) {
  revalidatePath(h.kind === "project" ? `/projects/${h.id}` : `/rentals/${h.id}`);
  revalidatePath(h.kind === "project" ? "/projects" : "/rentals");
}

export async function saveRateTable(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("settings.manage");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(rateTableInput, formData);
  const tiers = parseTiers(formData.getAll("tierDays").map(String), formData.getAll("tierFactor").map(String));
  if (!parsed.ok) return tiers.error ? { ...parsed.state, fieldErrors: { ...parsed.state.fieldErrors, tiers: tiers.error } } : parsed.state;
  if (tiers.error) return { ok: false, fieldErrors: { tiers: tiers.error }, values: echoValues(formData) };
  let tableId = id;
  try {
    if (id) await rateTables.update(actor, id, parsed.data, tiers.tiers);
    else tableId = (await rateTables.create(actor, parsed.data, tiers.tiers)).id;
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath("/settings/pricing", "layout");
  revalidatePath("/projects", "layout");
  revalidatePath("/rentals", "layout");
  if (!id) redirect(`/settings/pricing/${tableId}`);
  return { ok: true };
}

export async function deleteRateTable(formData: FormData): Promise<void> {
  const actor = await requirePermission("settings.manage");
  await rateTables.remove(actor, String(formData.get("id")));
  revalidatePath("/settings/pricing", "layout");
  redirect("/settings/pricing");
}

export async function saveQuoteSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const holder = holderFrom(formData);
  const actor = await requirePermission(holder.kind === "project" ? "projects.write" : "rentals.write");
  const parsed = parseForm(quoteSettingsInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await quotes.setSettings(actor, holder, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateHolder(holder);
  return { ok: true };
}

export async function saveExtraLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const holder = holderFrom(formData);
  const actor = await requirePermission(holder.kind === "project" ? "projects.write" : "rentals.write");
  const lineId = String(formData.get("lineId") ?? "");
  const parsed = parseForm(extraLineInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (lineId) await extraLines.update(actor, holder, lineId, parsed.data);
    else await extraLines.add(actor, holder, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateHolder(holder);
  return { ok: true };
}

export async function removeExtraLine(formData: FormData): Promise<void> {
  const holder = holderFrom(formData);
  const actor = await requirePermission(holder.kind === "project" ? "projects.write" : "rentals.write");
  await extraLines.remove(actor, holder, String(formData.get("id")));
  revalidateHolder(holder);
}
