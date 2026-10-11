"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { CF_PREFIX, customFieldsFromForm, validateCustomFields } from "@/lib/custom-fields";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { customFieldDefinitions } from "@/modules/settings";
import type { AllocationLike } from "./availability";
import { allocationInput, clientInput, contactInput, crewInput, projectInput, projectStatusInput } from "./schema";
import { allocations, clients, ConflictError, projects } from "./service";

function revalidateProjects(id?: string) {
  revalidatePath("/projects", "layout");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/projects/${id}`);
}

function prefixErrors(errors: Record<string, string>) {
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [CF_PREFIX + k, v]));
}

/* Clients */

export async function saveClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("projects.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(clientInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (id) await clients.update(actor, id, parsed.data);
    else await clients.create(actor, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateProjects();
  revalidatePath("/projects/clients");
  revalidatePath("/rentals", "layout");
  return { ok: true };
}

export async function deleteClient(formData: FormData): Promise<void> {
  const actor = await requirePermission("projects.write");
  await clients.remove(actor, String(formData.get("id")));
  revalidatePath("/projects/clients");
}

/* Projects */

export async function saveProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("projects.write");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(projectInput, formData);
  if (!parsed.ok) return parsed.state;
  const defs = await customFieldDefinitions.forEntity("project");
  const cf = validateCustomFields(defs, customFieldsFromForm(formData));
  if (!cf.ok) return { ok: false, fieldErrors: prefixErrors(cf.errors), values: echoValues(formData) };
  let projectId = id;
  try {
    if (id) await projects.update(actor, id, parsed.data, cf.values);
    else projectId = (await projects.create(actor, parsed.data, cf.values)).id;
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateProjects(projectId);
  redirect(`/projects/${projectId}`);
}

export async function setProjectStatus(formData: FormData): Promise<void> {
  const actor = await requirePermission("projects.write");
  const id = String(formData.get("id"));
  const parsed = projectStatusInput.parse({ status: formData.get("status") });
  await projects.setStatus(actor, id, parsed.status);
  revalidateProjects(id);
}

export async function deleteProject(formData: FormData): Promise<void> {
  const actor = await requirePermission("users.manage");
  await projects.remove(actor, String(formData.get("id")));
  revalidateProjects();
  redirect("/projects");
}

/* Contacts and crew */

export async function addContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("projects.write");
  const projectId = String(formData.get("projectId"));
  const parsed = parseForm(contactInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await projects.addContact(actor, projectId, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateProjects(projectId);
  return { ok: true };
}

export async function removeContact(formData: FormData): Promise<void> {
  const actor = await requirePermission("projects.write");
  await projects.removeContact(actor, String(formData.get("id")));
  revalidateProjects(String(formData.get("projectId")));
}

export async function addCrew(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("projects.write");
  const projectId = String(formData.get("projectId"));
  const parsed = parseForm(crewInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await projects.addCrew(actor, projectId, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidateProjects(projectId);
  return { ok: true };
}

export async function removeCrew(formData: FormData): Promise<void> {
  const actor = await requirePermission("projects.write");
  await projects.removeCrew(actor, String(formData.get("id")));
  revalidateProjects(String(formData.get("projectId")));
}

/* Reservations */

export type ReserveState = FormState<{ conflict?: { available: number; requested: number; shortfall: number; conflicts: AllocationLike[] } }>;

export async function reserve(_prev: ReserveState, formData: FormData): Promise<ReserveState> {
  const actor = await requirePermission("projects.write");
  const projectId = String(formData.get("projectId"));
  const allocationId = String(formData.get("allocationId") ?? "");
  const parsed = parseForm(allocationInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (allocationId) await allocations.update(actor, allocationId, parsed.data);
    else await allocations.reserve(actor, projectId, parsed.data);
  } catch (err) {
    if (err instanceof ConflictError) {
      return {
        ok: false,
        values: echoValues(formData),
        data: { conflict: { available: err.check.available, requested: err.check.requested, shortfall: err.check.shortfall, conflicts: err.check.conflicts } },
      };
    }
    return errorState(err, echoValues(formData));
  }
  revalidateProjects(projectId);
  revalidatePath("/inventory", "layout");
  return { ok: true };
}

export async function removeReservation(formData: FormData): Promise<void> {
  const actor = await requirePermission("projects.write");
  await allocations.remove(actor, String(formData.get("id")));
  revalidateProjects(String(formData.get("projectId")));
  revalidatePath("/inventory", "layout");
}
