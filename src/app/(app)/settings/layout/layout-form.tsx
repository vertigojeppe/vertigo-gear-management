"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { ActionForm } from "@/components/form/action-form";
import { FormError, FormSuccess } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import type { FormState } from "@/lib/forms";
import { saveLayout } from "@/modules/settings/actions";
import { LAYOUTS, type Layout } from "../../../../../config/app.config";

/** Roomy or compact, as two radio cards. */
export function LayoutForm({ layout }: { layout: Layout }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveLayout, {});
  return (
    <ActionForm action={action} className="flex max-w-2xl flex-col gap-3">
      <FormError message={state.error ?? state.fieldErrors?.layout} />
      <FormSuccess message={state.ok ? t("layoutSaved") : undefined} />
      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="sr-only">{t("layout")}</legend>
        {LAYOUTS.map((key) => (
          <label key={key} className={cn("flex cursor-pointer gap-3 rounded-md border p-4 has-[:checked]:border-foreground has-[:checked]:bg-muted/50")}>
            <input type="radio" name="layout" value={key} defaultChecked={key === layout} className="mt-1" />
            <span>
              <span className="block font-medium">{t(`layout_${key}`)}</span>
              <span className="block text-sm text-muted-foreground">{t(`layout_${key}Help`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div>
        <SubmitButton pendingText={tc("loading")}>{tc("save")}</SubmitButton>
      </div>
    </ActionForm>
  );
}
