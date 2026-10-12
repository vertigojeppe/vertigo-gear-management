"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/forms";
import { uploadSpreadsheet } from "../actions";

/** Plain <form action>: the file is small and a reset after success is wanted. */
export function ImportUploadForm() {
  const t = useTranslations("importer");
  const [state, action] = useActionState<FormState, FormData>(uploadSpreadsheet, {});
  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <FormError message={state.error} />
      <Field id="import-file" label={t("file")} help={t("fileHelp")} error={state.fieldErrors?.file}>
        <Input id="import-file" name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
      </Field>
      <div>
        <SubmitButton pendingText={t("reading")}>{t("preview")}</SubmitButton>
      </div>
    </form>
  );
}
