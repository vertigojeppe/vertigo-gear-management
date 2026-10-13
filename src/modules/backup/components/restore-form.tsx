"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormError, FormSuccess } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { restoreBackup, type RestoreState } from "../actions";

/** Plain <form action>: the file input must reset after a run. */
export function RestoreForm() {
  const t = useTranslations("backup");
  const [state, action] = useActionState<RestoreState, FormData>(restoreBackup, {});
  return (
    <form action={action} className="flex max-w-xl flex-col gap-4 rounded-md border border-destructive/40 p-4">
      <p className="text-sm font-medium text-destructive">{t("restoreWarning")}</p>
      <FormError message={state.error} />
      <FormSuccess message={state.ok && state.data ? t("restored", { rows: state.data.rows, tables: state.data.tables }) : undefined} />
      <Field id="backup-file" label={t("file")} error={state.fieldErrors?.file}>
        <Input id="backup-file" name="file" type="file" accept=".json,application/json" required />
      </Field>
      <Field id="backup-confirm" label={t("confirmLabel")} help={t("confirmHelp")} error={state.fieldErrors?.confirm}>
        <Input id="backup-confirm" name="confirm" autoComplete="off" required />
      </Field>
      <div>
        <SubmitButton variant="destructive" pendingText={t("restoring")}>
          {t("restore")}
        </SubmitButton>
      </div>
    </form>
  );
}
