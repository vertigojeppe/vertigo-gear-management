"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError, FormSuccess } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { saveGlossary } from "@/modules/settings/actions";

/** The whole glossary as text, one group per line; saving replaces it. */
export function GlossaryForm({ text }: { text: string }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState<{ count: number }>, FormData>(saveGlossary, {});
  return (
    <ActionForm action={action} className="flex max-w-3xl flex-col gap-3">
      <FormError message={state.error} />
      <FormSuccess message={state.ok && state.data ? t("glossarySaved", { count: state.data.count }) : undefined} />
      <Field id="glossary" label={t("glossaryText")} error={state.fieldErrors?.text}>
        <Textarea id="glossary" name="text" rows={24} defaultValue={state.values?.text ?? text} spellCheck={false} className="font-mono text-sm" />
      </Field>
      <div>
        <SubmitButton pendingText={tc("loading")}>{tc("save")}</SubmitButton>
      </div>
    </ActionForm>
  );
}
