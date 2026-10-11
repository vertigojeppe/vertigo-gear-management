"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Field, FormError } from "@/components/form/field";
import { CustomFieldInputs } from "@/components/form/custom-field-inputs";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button";
import type { CustomFieldDef } from "@/lib/custom-fields";
import type { FormState } from "@/lib/forms";
import { saveModel } from "../actions";
import { linksToText, TRACKING_TYPES } from "../schema";
import type { ModelDto } from "../service";

type Option = { id: string; name: string; depth: number };

export function ModelForm({
  model,
  categories,
  defs,
  defaultCategoryId,
  hasItems,
}: {
  model?: ModelDto;
  categories: Option[];
  defs: CustomFieldDef[];
  defaultCategoryId?: string;
  hasItems?: boolean;
}) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveModel, {});
  const v = (name: string, fallback: string | number | null | undefined) =>
    state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback);
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-6">
      {model && <input type="hidden" name="id" value={model.id} />}
      <FormError message={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="manufacturer" label={t("manufacturer")} error={err.manufacturer}>
          <Input id="manufacturer" name="manufacturer" defaultValue={v("manufacturer", model?.manufacturer)} required autoFocus={!model} />
        </Field>
        <Field id="name" label={t("modelName")} error={err.name}>
          <Input id="name" name="name" defaultValue={v("name", model?.name)} required />
        </Field>
        <Field id="categoryId" label={t("category")} error={err.categoryId}>
          <NativeSelect id="categoryId" name="categoryId" defaultValue={v("categoryId", model?.categoryId ?? defaultCategoryId)} required>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {"  ".repeat(c.depth)}
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="trackingType" label={t("trackingType")} help={t("trackingHelp")} error={err.trackingType}>
          <NativeSelect id="trackingType" name="trackingType" defaultValue={v("trackingType", model?.trackingType ?? "serialized")} disabled={hasItems}>
            {TRACKING_TYPES.map((tt) => (
              <option key={tt} value={tt}>
                {t(tt)}
              </option>
            ))}
          </NativeSelect>
          {hasItems && <input type="hidden" name="trackingType" value={model?.trackingType} />}
        </Field>
      </div>

      <Field id="description" label={t("description")} optional error={err.description}>
        <Textarea id="description" name="description" rows={3} defaultValue={v("description", model?.description)} />
      </Field>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-sm font-medium">{t("specs")}</legend>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field id="weightKg" label={t("weightKg")} optional error={err.weightKg}>
            <Input id="weightKg" name="weightKg" type="number" step="0.001" min="0" defaultValue={v("weightKg", model?.weightKg)} />
          </Field>
          <Field id="widthCm" label={`${t("widthCm")} (cm)`} optional error={err.widthCm}>
            <Input id="widthCm" name="widthCm" type="number" step="0.1" min="0" defaultValue={v("widthCm", model?.widthCm)} />
          </Field>
          <Field id="heightCm" label={`${t("heightCm")} (cm)`} optional error={err.heightCm}>
            <Input id="heightCm" name="heightCm" type="number" step="0.1" min="0" defaultValue={v("heightCm", model?.heightCm)} />
          </Field>
          <Field id="depthCm" label={`${t("depthCm")} (cm)`} optional error={err.depthCm}>
            <Input id="depthCm" name="depthCm" type="number" step="0.1" min="0" defaultValue={v("depthCm", model?.depthCm)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="powerDrawW" label={t("powerDrawW")} optional error={err.powerDrawW}>
            <Input id="powerDrawW" name="powerDrawW" type="number" step="1" min="0" defaultValue={v("powerDrawW", model?.powerDrawW)} />
          </Field>
        </div>
        <Field id="linksText" label={t("links")} optional help={t("linksHelp")} error={err.linksText}>
          <Textarea id="linksText" name="linksText" rows={3} defaultValue={v("linksText", model ? linksToText(model.links) : "")} />
        </Field>
        <Field id="notes" label={tc("notes")} optional error={err.notes}>
          <Textarea id="notes" name="notes" rows={3} defaultValue={v("notes", model?.notes)} />
        </Field>
      </fieldset>

      <CustomFieldInputs defs={defs} values={model?.customFields} echoed={state.values} errors={err} title={t("customFields")} />

      <div className="flex gap-2">
        <SubmitButton pendingText={tc("loading")}>{tc("save")}</SubmitButton>
        <Link href={model ? `/inventory/models/${model.id}` : "/inventory"} className={buttonVariants({ variant: "outline" })}>
          {tc("cancel")}
        </Link>
      </div>
    </form>
  );
}
