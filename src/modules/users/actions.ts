"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActor, requirePermission } from "@/lib/auth/session";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { apiTokenInput, changeOwnPasswordInput, createUserInput, setPasswordInput, userInput } from "./schema";
import { apiTokens, users } from "./service";

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("users.manage");
  const parsed = parseForm(createUserInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await users.create(actor, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath("/settings/users");
  redirect("/settings/users");
}

export async function updateUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("users.manage");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(userInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await users.update(actor, id, parsed.data);
  } catch (err) {
    return errorState(err, echoValues(formData));
  }
  revalidatePath("/settings/users");
  return { ok: true };
}

export async function resetUserPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("users.manage");
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(setPasswordInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await users.setPassword(actor, id, parsed.data.password);
  } catch (err) {
    return errorState(err);
  }
  return { ok: true };
}

export async function changeOwnPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor();
  const parsed = parseForm(changeOwnPasswordInput, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await users.changeOwnPassword(actor, parsed.data.current, parsed.data.password);
  } catch (err) {
    return errorState(err);
  }
  return { ok: true };
}

export async function createApiToken(_prev: FormState<{ token: string }>, formData: FormData): Promise<FormState<{ token: string }>> {
  const actor = await requireActor();
  const parsed = parseForm(apiTokenInput, formData);
  if (!parsed.ok) return parsed.state;
  const result = await apiTokens.create(actor, parsed.data.name);
  revalidatePath("/settings/account");
  return { ok: true, data: { token: result.token } };
}

export async function revokeApiToken(formData: FormData): Promise<void> {
  const actor = await requireActor();
  await apiTokens.revoke(actor, String(formData.get("id")));
  revalidatePath("/settings/account");
}
