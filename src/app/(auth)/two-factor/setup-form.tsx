"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/forms";
import { confirmTwoFactor } from "@/modules/users/actions";
import { RecoveryCodes } from "@/app/(app)/settings/account/two-factor-forms";

/** First code from the app → 2FA on; then the recovery codes, once, and a way on. */
export function TwoFactorSetupForm({ sealed, next }: { sealed: string; next: string }) {
  const t = useTranslations("twoFactor");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState<{ codes: string[] }>, FormData>(confirmTwoFactor, {});
  if (state.ok && state.data?.codes) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-green-700 dark:text-green-400">{t("done")}</p>
        <RecoveryCodes codes={state.data.codes} />
        <Link href={next} className={buttonVariants()}>
          {t("continue")}
        </Link>
      </div>
    );
  }
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <input type="hidden" name="sealed" value={sealed} />
      <FormError message={state.error} />
      <Field id="code" label={t("code")} error={state.fieldErrors?.code}>
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required autoFocus />
      </Field>
      <SubmitButton pendingText={tc("loading")}>{t("confirm")}</SubmitButton>
    </ActionForm>
  );
}
