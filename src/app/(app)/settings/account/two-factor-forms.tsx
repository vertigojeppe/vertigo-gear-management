"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError, FormSuccess } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/forms";
import { disableTwoFactor, renewRecoveryCodes } from "@/modules/users/actions";

/** The recovery codes, shown once after setup or renewal. */
export function RecoveryCodes({ codes }: { codes: string[] }) {
  const t = useTranslations("settings");
  return (
    <div className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <p className="font-medium">{t("recoveryCodesTitle")}</p>
      <p>{t("recoveryCodesHelp")}</p>
      <ul className="grid grid-cols-2 gap-1 font-mono" aria-label={t("recoveryCodesTitle")}>
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}

/** Account page: status, plus set up / new recovery codes / turn off. */
export function TwoFactorSection({ enabled, since, recoveryLeft, required }: { enabled: boolean; since: string | null; recoveryLeft: number; required: boolean }) {
  const t = useTranslations("settings");
  if (!enabled) {
    return (
      <div>
        <Link href="/two-factor" className={buttonVariants({ variant: "outline" })}>
          {t("twoFactorSetUp")}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">{t("twoFactorOn", { since: since ?? "", count: recoveryLeft })}</p>
      <RenewRecoveryCodesForm />
      {required ? <p className="text-sm text-muted-foreground">{t("twoFactorRequired")}</p> : <DisableTwoFactorForm />}
    </div>
  );
}

function CodeField({ id, error }: { id: string; error?: string }) {
  const t = useTranslations("settings");
  return (
    <Field id={id} label={t("twoFactorCode")} error={error} className="flex-1">
      <Input id={id} name="code" autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} required />
    </Field>
  );
}

function RenewRecoveryCodesForm() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState<{ codes: string[] }>, FormData>(renewRecoveryCodes, {});
  return (
    <ActionForm action={action} className="flex max-w-md flex-col gap-3">
      <FormError message={state.error} />
      {state.ok && state.data?.codes && <RecoveryCodes codes={state.data.codes} />}
      <div className="flex items-end gap-2">
        <CodeField id="renew-code" error={state.fieldErrors?.code} />
        <SubmitButton variant="outline" pendingText={tc("loading")}>
          {t("recoveryCodesRenew")}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

function DisableTwoFactorForm() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(disableTwoFactor, {});
  return (
    <ActionForm action={action} className="flex max-w-md flex-col gap-3">
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? t("twoFactorTurnedOff") : undefined} />
      <div className="flex items-end gap-2">
        <CodeField id="disable-code" error={state.fieldErrors?.code} />
        <SubmitButton variant="outline" pendingText={tc("loading")}>
          {t("twoFactorTurnOff")}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
