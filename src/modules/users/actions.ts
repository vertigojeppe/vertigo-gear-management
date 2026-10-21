"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { currentUserLocale, getActor, requireActor, requireActorForTwoFactorSetup, requirePermission } from "@/lib/auth/session";
import { isLocale, LOCALE_COOKIE } from "@/lib/locale";
import { prisma } from "@/lib/db";
import { echoValues, errorState, parseForm, type FormState } from "@/lib/forms";
import { apiTokenInput, changeOwnPasswordInput, createUserInput, setPasswordInput, userInput } from "./schema";
import { apiTokens, users } from "./service";
import { twoFactor } from "./two-factor";

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

/* Two-factor sign-in */

/** Setup page: the sealed secret from the page plus the first code from the app. Returns the recovery codes once. */
export async function confirmTwoFactor(_prev: FormState<{ codes: string[] }>, formData: FormData): Promise<FormState<{ codes: string[] }>> {
  const { actor } = await requireActorForTwoFactorSetup();
  try {
    const codes = await twoFactor.confirm(actor, String(formData.get("sealed") ?? ""), String(formData.get("code") ?? ""));
    // No revalidatePath: it would re-render the setup page, which sends a user with 2FA on
    // to the account page before the recovery codes have been shown.
    return { ok: true, data: { codes } };
  } catch (err) {
    const { error, fieldErrors } = errorState(err);
    return { ok: false, error, fieldErrors };
  }
}

export async function renewRecoveryCodes(_prev: FormState<{ codes: string[] }>, formData: FormData): Promise<FormState<{ codes: string[] }>> {
  const actor = await requireActor();
  try {
    const codes = await twoFactor.regenerateRecoveryCodes(actor, String(formData.get("code") ?? ""));
    revalidatePath("/settings/account");
    return { ok: true, data: { codes } };
  } catch (err) {
    const { error, fieldErrors } = errorState(err);
    return { ok: false, error, fieldErrors };
  }
}

export async function disableTwoFactor(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor();
  try {
    await twoFactor.disable(actor, String(formData.get("code") ?? ""));
  } catch (err) {
    return errorState(err);
  }
  revalidatePath("/settings/account");
  return { ok: true };
}

/** Admin: clear a user's 2FA (lost phone). */
export async function resetTwoFactor(formData: FormData): Promise<void> {
  const actor = await requirePermission("users.manage");
  const id = String(formData.get("id") ?? "");
  await twoFactor.reset(actor, id);
  revalidatePath(`/settings/users/${id}`);
  revalidatePath("/settings/users");
}

/**
 * The language switch: a cookie for this browser (also on the sign-in page)
 * and, when signed in, the user's saved choice, which follows them to every
 * device. Re-renders the whole app in the new language.
 */
export async function setLanguage(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const actor = await getActor();
  if (actor && (await currentUserLocale()) !== locale) await prisma.user.update({ where: { id: actor.id }, data: { locale } });
  revalidatePath("/", "layout");
}
