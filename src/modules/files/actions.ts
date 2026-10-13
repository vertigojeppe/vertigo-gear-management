"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import type { ActivityEntity } from "@/lib/activity";
import { errorState, type FormState } from "@/lib/forms";
import { ATTACHMENT_KINDS, type AttachmentKind } from "../../../config/app.config";
import { files } from "./service";

const ENTITY_TYPES: ActivityEntity[] = ["item", "model", "project", "rental", "purchase"];

export async function uploadAttachment(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("files.write");
  const entityType = String(formData.get("entityType")) as ActivityEntity;
  const entityId = String(formData.get("entityId"));
  const kind = String(formData.get("kind")) as AttachmentKind;
  const file = formData.get("file");
  const returnTo = String(formData.get("returnTo") ?? "");
  if (!ENTITY_TYPES.includes(entityType) || !entityId) return { ok: false, error: "Invalid target." };
  if (!ATTACHMENT_KINDS.includes(kind)) return { ok: false, error: "Invalid kind." };
  if (!(file instanceof File)) return { ok: false, fieldErrors: { file: "Choose a file." } };
  try {
    await files.upload(actor, { entityType, entityId, kind, file });
  } catch (err) {
    return errorState(err);
  }
  if (returnTo.startsWith("/")) revalidatePath(returnTo);
  return { ok: true };
}

export async function deleteAttachment(formData: FormData): Promise<void> {
  const actor = await requirePermission("files.write");
  const returnTo = String(formData.get("returnTo") ?? "");
  await files.removeAttachment(actor, String(formData.get("id")));
  if (returnTo.startsWith("/")) revalidatePath(returnTo);
}
