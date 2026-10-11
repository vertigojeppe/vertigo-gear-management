"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/form/action-form";
import { useTranslations } from "next-intl";
import { Field, FormError, FormSuccess } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/forms";
import { changeOwnPassword, createApiToken, revokeApiToken } from "@/modules/users/actions";

export function ChangePasswordForm() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(changeOwnPassword, {});
  const err = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="flex max-w-sm flex-col gap-3">
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? t("passwordChanged") : undefined} />
      <Field id="current" label={t("currentPassword")} error={err.current}>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field id="password" label={t("newPassword")} error={err.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field id="confirm" label={t("confirmPassword")} error={err.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <div>
        <SubmitButton pendingText={tc("loading")}>{t("changePassword")}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ApiTokenForm() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState<{ token: string }>, FormData>(createApiToken, {});
  return (
    <ActionForm action={action} className="flex max-w-lg flex-col gap-3">
      <FormError message={state.error} />
      {state.ok && state.data?.token && (
        <div className="rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm">
          <p className="mb-1">{t("tokenCreated")}</p>
          <code className="block break-all rounded bg-background px-2 py-1 font-mono text-xs">{state.data.token}</code>
        </div>
      )}
      <div className="flex items-end gap-2">
        <Field id="tokenName" label={t("tokenName")} error={state.fieldErrors?.name} className="flex-1">
          <Input id="tokenName" name="name" placeholder="TouchDesigner" required />
        </Field>
        <SubmitButton variant="outline" pendingText={tc("loading")}>
          {t("createToken")}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function RevokeTokenButton({ id }: { id: string }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  return (
    <form action={revokeApiToken}>
      <input type="hidden" name="id" value={id} />
      <ConfirmButton confirm={tc("confirm")} variant="ghost" size="xs" className="text-destructive">
        {t("revoke")}
      </ConfirmButton>
    </form>
  );
}
