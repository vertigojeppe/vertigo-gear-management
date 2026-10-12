"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
// eslint-disable-next-line no-restricted-imports -- share links live in the packing service; its barrel is fine here but the service file keeps this module's import graph small
import { shareLinks } from "@/modules/packing/service";
import { applyTemplateInput, createPlanInput, logisticsInput, planInput, planTemplateInput, saveAsTemplateInput, scheduleEntryInput, taskInput, templateEntryInput } from "./schema";
import { logistics, planTemplates, plans, schedule, tasks } from "./service";
import { documents, type Shape } from "./documents";

function revalidatePlan(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/plan`);
}

const projectIdOf = (fd: FormData) => String(fd.get("projectId") ?? "");
const planIdOf = (fd: FormData) => String(fd.get("planId") ?? "");

/* Plan ------------------------------------------------------------------- */

export async function createPlan(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("plans.write");
  const projectId = projectIdOf(formData);
  const parsed = parseForm(createPlanInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await plans.ensure(actor, projectId, { templateId: parsed.data.templateId, anchorDate: parsed.data.anchorDate });
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePlan(projectId);
  redirect(`/projects/${projectId}/plan`);
}

export async function updatePlanNotes(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("plans.write");
  const parsed = parseForm(planInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await plans.update(actor, planIdOf(formData), parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePlan(projectIdOf(formData));
  return { ok: true };
}

export async function deletePlan(formData: FormData): Promise<void> {
  const actor = await requirePermission("plans.write");
  const projectId = projectIdOf(formData);
  await plans.remove(actor, planIdOf(formData));
  revalidatePlan(projectId);
  redirect(`/projects/${projectId}`);
}

export async function applyPlanTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("plans.write");
  const parsed = parseForm(applyTemplateInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await plans.applyTemplate(actor, planIdOf(formData), parsed.data.templateId, parsed.data.anchorDate);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePlan(projectIdOf(formData));
  return { ok: true };
}

export async function savePlanAsTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("plans.write");
  const parsed = parseForm(saveAsTemplateInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await plans.saveAsTemplate(actor, planIdOf(formData), parsed.data.name, parsed.data.anchorDate);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath("/projects/plan-templates", "layout");
  return { ok: true };
}

/* Schedule --------------------------------------------------------------- */

export async function saveScheduleEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("plans.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(scheduleEntryInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (id) await schedule.update(actor, id, parsed.data);
    else await schedule.add(actor, planIdOf(formData), parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePlan(projectIdOf(formData));
  return { ok: true };
}

export async function removeScheduleEntry(formData: FormData): Promise<void> {
  const actor = await requirePermission("plans.write");
  await schedule.remove(actor, String(formData.get("id")));
  revalidatePlan(projectIdOf(formData));
}

/* Tasks ------------------------------------------------------------------ */

export async function saveTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("plans.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(taskInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (id) await tasks.update(actor, id, parsed.data);
    else await tasks.add(actor, planIdOf(formData), parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePlan(projectIdOf(formData));
  return { ok: true };
}

export async function setTaskDone(formData: FormData): Promise<void> {
  const actor = await requirePermission("plans.write");
  await tasks.setDone(actor, String(formData.get("id")), formData.get("done") === "true");
  revalidatePlan(projectIdOf(formData));
}

export async function removeTask(formData: FormData): Promise<void> {
  const actor = await requirePermission("plans.write");
  await tasks.remove(actor, String(formData.get("id")));
  revalidatePlan(projectIdOf(formData));
}

/* Logistics -------------------------------------------------------------- */

export async function saveLogistics(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("plans.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(logisticsInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (id) await logistics.update(actor, id, parsed.data);
    else await logistics.add(actor, planIdOf(formData), parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePlan(projectIdOf(formData));
  return { ok: true };
}

export async function removeLogistics(formData: FormData): Promise<void> {
  const actor = await requirePermission("plans.write");
  await logistics.remove(actor, String(formData.get("id")));
  revalidatePlan(projectIdOf(formData));
}

/* Templates -------------------------------------------------------------- */

export async function savePlanTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("plans.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(planTemplateInput, formData);
  if (!parsed.ok) return parsed.state;
  let templateId = id;
  try {
    if (id) await planTemplates.update(actor, id, parsed.data);
    else templateId = (await planTemplates.create(actor, parsed.data)).id;
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath("/projects/plan-templates", "layout");
  if (!id) redirect(`/projects/plan-templates/${templateId}`);
  return { ok: true };
}

export async function deletePlanTemplate(formData: FormData): Promise<void> {
  const actor = await requirePermission("plans.write");
  await planTemplates.remove(actor, String(formData.get("id")));
  revalidatePath("/projects/plan-templates", "layout");
  redirect("/projects/plan-templates");
}

export async function saveTemplateEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("plans.write");
  const id = String(formData.get("id") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  const parsed = parseForm(templateEntryInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (id) await planTemplates.updateEntry(actor, id, parsed.data);
    else await planTemplates.addEntry(actor, templateId, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath(`/projects/plan-templates/${templateId}`);
  return { ok: true };
}

export async function removeTemplateEntry(formData: FormData): Promise<void> {
  const actor = await requirePermission("plans.write");
  await planTemplates.removeEntry(actor, String(formData.get("id")));
  revalidatePath(`/projects/plan-templates/${String(formData.get("templateId"))}`);
}

/* Share links ------------------------------------------------------------ */

export async function createPlanShareLink(formData: FormData): Promise<void> {
  const actor = await requirePermission("share.create");
  await shareLinks.ensure(actor, "plan", planIdOf(formData));
  revalidatePlan(projectIdOf(formData));
}

export async function revokePlanShareLink(formData: FormData): Promise<void> {
  const actor = await requirePermission("share.create");
  await shareLinks.revoke(actor, "plan", planIdOf(formData));
  revalidatePlan(projectIdOf(formData));
}

/* Documents -------------------------------------------------------------- */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function planProjectId(planId: string) {
  const { prisma } = await import("@/lib/db");
  return (await prisma.productionPlan.findUnique({ where: { id: planId }, select: { projectId: true } }))?.projectId ?? null;
}

/** Called by the uploader once all chunks are in. */
export async function attachUploadedFile(input: { planId: string; fileId: string; name?: string; note?: string; scheduleEntryId?: string; taskId?: string }): Promise<Result<{ documentId: string; version: number }>> {
  const actor = await requirePermission("plans.write");
  try {
    const r = await documents.add(actor, input.planId, { fileId: input.fileId, name: input.name, note: input.note, scheduleEntryId: input.scheduleEntryId ?? undefined, taskId: input.taskId ?? undefined });
    const projectId = await planProjectId(input.planId);
    if (projectId) revalidatePlan(projectId);
    return { ok: true, documentId: r.doc.id, version: r.version.version };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not attach the file." };
  }
}

export async function setDocumentPreview(input: { documentId: string; fileId: string | null }): Promise<Result> {
  const actor = await requirePermission("plans.write");
  try {
    const doc = await documents.setPreview(actor, input.documentId, input.fileId);
    const projectId = await planProjectId(doc.planId);
    if (projectId) revalidatePlan(projectId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not set the preview." };
  }
}

export async function saveMarkup(input: { versionId: string; page: number; shapes: Shape[] }): Promise<Result<{ shapes?: Shape[] }>> {
  const actor = await requirePermission("plans.write");
  try {
    const row = await documents.saveMarkup(actor, input.versionId, input.page, input.shapes);
    return { ok: true, shapes: row.shapes as Shape[] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save the markup." };
  }
}

export async function pinDocument(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("plans.write");
  const target = String(formData.get("target") ?? "");
  const [kind, targetId] = target.split(":");
  try {
    await documents.pin(actor, String(formData.get("documentId")), { scheduleEntryId: kind === "entry" ? targetId : null, taskId: kind === "task" ? targetId : null });
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePlan(projectIdOf(formData));
  return { ok: true };
}

export async function removeDocument(formData: FormData): Promise<void> {
  const actor = await requirePermission("plans.write");
  const projectId = projectIdOf(formData);
  await documents.remove(actor, String(formData.get("documentId")));
  revalidatePlan(projectId);
  redirect(`/projects/${projectId}/plan`);
}

export async function removeDocumentVersion(formData: FormData): Promise<void> {
  const actor = await requirePermission("plans.write");
  const projectId = projectIdOf(formData);
  await documents.removeVersion(actor, String(formData.get("versionId")));
  revalidatePlan(projectId);
  redirect(`/projects/${projectId}/plan/documents/${String(formData.get("documentId"))}`);
}
