"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { checkInInput, lineInput, lineUpdateInput, packingListInput, scanInput, templateInput, templateLineInput, tickInput } from "./schema";
import { packingChecks, packingLines, packingLists, packingTemplates, shareLinks, undoCheckIn } from "./service";

function revalidateList(projectId: string, listId?: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/inventory", "layout");
  revalidatePath("/dashboard");
  if (listId) revalidatePath(`/projects/${projectId}/packing/${listId}`, "layout");
}

/* Lists */

export async function createPackingList(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  const parsed = parseForm(packingListInput, formData);
  if (!parsed.ok) return parsed.state;
  let listId: string;
  try {
    listId = (await packingLists.create(actor, projectId, parsed.data)).id;
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateList(projectId, listId);
  redirect(`/projects/${projectId}/packing/${listId}`);
}

export async function updatePackingList(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  const parsed = parseForm(packingListInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await packingLists.update(actor, listId, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateList(projectId, listId);
  return { ok: true };
}

export async function deletePackingList(formData: FormData): Promise<void> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  await packingLists.remove(actor, String(formData.get("listId")));
  revalidateList(projectId);
  redirect(`/projects/${projectId}`);
}

export async function checkOutList(formData: FormData): Promise<void> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  await packingLists.checkOut(actor, listId);
  revalidateList(projectId, listId);
  redirect(`/projects/${projectId}/packing/${listId}`);
}

export async function finishCheckIn(formData: FormData): Promise<void> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  await packingLists.finishCheckIn(actor, listId);
  revalidateList(projectId, listId);
  redirect(`/projects/${projectId}/packing/${listId}`);
}

/* Lines */

export async function addLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  const parsed = parseForm(lineInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await packingLines.add(actor, listId, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateList(projectId, listId);
  return { ok: true };
}

export async function addKitLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  const kitItemId = String(formData.get("kitItemId") ?? "");
  if (!kitItemId) return { ok: false, fieldErrors: { kitItemId: "Choose a kit." } };
  try {
    await packingLines.addKit(actor, listId, kitItemId);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateList(projectId, listId);
  return { ok: true };
}

export async function applyTemplateToList(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) return { ok: false, fieldErrors: { templateId: "Choose a template." } };
  try {
    await packingLines.applyTemplate(actor, listId, templateId);
  } catch (err) {
    return errorState(err);
  }
  revalidateList(projectId, listId);
  return { ok: true };
}

export async function addReservedLines(formData: FormData): Promise<void> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  await packingLines.addFromReservations(actor, listId);
  revalidateList(projectId, listId);
}

export async function updateLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  const lineId = String(formData.get("lineId"));
  const parsed = parseForm(lineUpdateInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await packingLines.update(actor, lineId, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateList(projectId, listId);
  return { ok: true };
}

export async function removeLine(formData: FormData): Promise<void> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  await packingLines.remove(actor, String(formData.get("lineId")));
  revalidateList(projectId, listId);
}

/* Packing mode */

export async function tickLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  const parsed = parseForm(tickInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await packingChecks.tick(actor, parsed.data);
  } catch (err) {
    return errorState(err);
  }
  revalidateList(projectId, listId);
  return { ok: true };
}

export async function untickCheck(formData: FormData): Promise<void> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  await packingChecks.untick(actor, String(formData.get("checkId")));
  revalidateList(projectId, listId);
}

export async function undoReturn(formData: FormData): Promise<void> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  await undoCheckIn(actor, String(formData.get("checkId")));
  revalidateList(projectId, listId);
}

export type ScanState = FormState<Awaited<ReturnType<typeof packingChecks.scan>>>;

export async function scanTag(_prev: ScanState, formData: FormData): Promise<ScanState> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  const parsed = parseForm(scanInput, formData);
  if (!parsed.ok) return parsed.state;
  const result = await packingChecks.scan(actor, listId, parsed.data.tag);
  revalidateList(projectId, listId);
  return { ok: result.status === "ticked", data: result };
}

/* Check-in */

export async function checkInUnit(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("packing.write");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  const parsed = parseForm(checkInInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await packingChecks.checkIn(actor, parsed.data);
  } catch (err) {
    return errorState(err);
  }
  revalidateList(projectId, listId);
  return { ok: true };
}

/* Templates */

export async function saveTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("packing.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(templateInput, formData);
  if (!parsed.ok) return parsed.state;
  let templateId = id;
  try {
    if (id) await packingTemplates.update(actor, id, parsed.data);
    else templateId = (await packingTemplates.create(actor, parsed.data)).id;
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath("/projects/packing-templates", "layout");
  if (!id) redirect(`/projects/packing-templates/${templateId}`);
  return { ok: true };
}

export async function deleteTemplate(formData: FormData): Promise<void> {
  const actor = await requirePermission("packing.write");
  await packingTemplates.remove(actor, String(formData.get("id")));
  revalidatePath("/projects/packing-templates", "layout");
  redirect("/projects/packing-templates");
}

export async function addTemplateLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("packing.write");
  const templateId = String(formData.get("templateId"));
  const parsed = parseForm(templateLineInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await packingTemplates.addLine(actor, templateId, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath(`/projects/packing-templates/${templateId}`);
  return { ok: true };
}

export async function removeTemplateLine(formData: FormData): Promise<void> {
  const actor = await requirePermission("packing.write");
  const templateId = String(formData.get("templateId"));
  await packingTemplates.removeLine(actor, String(formData.get("lineId")));
  revalidatePath(`/projects/packing-templates/${templateId}`);
}

export async function saveListAsTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("packing.write");
  const listId = String(formData.get("listId"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, fieldErrors: { name: "Give the template a name." } };
  try {
    await packingTemplates.createFromList(actor, listId, name);
  } catch (err) {
    return errorState(err);
  }
  revalidatePath("/projects/packing-templates", "layout");
  return { ok: true };
}

/* Share links */

export async function createShareLink(formData: FormData): Promise<void> {
  const actor = await requirePermission("share.create");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  await shareLinks.ensure(actor, "packing_list", listId);
  revalidateList(projectId, listId);
}

export async function revokeShareLink(formData: FormData): Promise<void> {
  const actor = await requirePermission("share.create");
  const projectId = String(formData.get("projectId"));
  const listId = String(formData.get("listId"));
  await shareLinks.revoke(actor, "packing_list", listId);
  revalidateList(projectId, listId);
}
