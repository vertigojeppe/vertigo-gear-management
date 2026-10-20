"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/form/action-form";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Field, FormError } from "@/components/form/field";
import { CustomFieldInputs } from "@/components/form/custom-field-inputs";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button";
import { applicableDefs, type CustomFieldDef } from "@/lib/custom-fields";
import type { FormState } from "@/lib/forms";
import { appConfig } from "../../../../config/app.config";
import { saveModel } from "../actions";
import { linksToText, TRACKING_TYPES } from "../schema";
import type { ModelDto } from "../service";

type Option = { id: string; name: string; depth: number };

export function ModelForm({
  model,
  prefill,
  wishId,
  categories,
  defs,
  defaultCategoryId,
  hasItems,
}: {
  model?: ModelDto;
  /** "New variant of …": defaults copied from a sibling (without its variant), or the fields of a wish being converted. */
  prefill?: Partial<ModelDto>;
  /** Set when the form converts a wish: saving marks it bought and links the model. */
  wishId?: string;
  categories: Option[];
  defs: CustomFieldDef[];
  defaultCategoryId?: string;
  hasItems?: boolean;
}) {
  const base = model ?? prefill;
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveModel, {});
  const v = (name: string, fallback: string | number | null | undefined) =>
    state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback);
  const err = state.fieldErrors ?? {};
  const [categoryId, setCategoryId] = useState(v("categoryId", base?.categoryId ?? defaultCategoryId));
  const [consumable, setConsumable] = useState(state.values ? state.values.consumable === "on" : Boolean(base?.consumable));
  const [unit, setUnit] = useState(v("unit", base?.unit ?? "pcs"));

  return (
    <ActionForm action={action} className="flex max-w-2xl flex-col gap-6">
      {model && <input type="hidden" name="id" value={model.id} />}
      {wishId && <input type="hidden" name="wishId" value={wishId} />}
      <FormError message={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="manufacturer" label={t("manufacturer")} help={t("manufacturerHelp")} optional error={err.manufacturer}>
          <Input id="manufacturer" name="manufacturer" defaultValue={v("manufacturer", base?.manufacturer)} autoFocus={!model} />
        </Field>
        <Field id="name" label={t("modelName")} help={t("modelNameHelp")} error={err.name}>
          <Input id="name" name="name" defaultValue={v("name", base?.name)} required />
        </Field>
        <Field id="variant" label={t("variant")} help={t("variantHelp")} optional error={err.variant}>
          <Input id="variant" name="variant" defaultValue={v("variant", model ? model.variant : wishId ? prefill?.variant : undefined)} autoFocus={Boolean(prefill) && !wishId} />
        </Field>
        <Field id="categoryId" label={t("category")} error={err.categoryId}>
          <NativeSelect id="categoryId" name="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
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
          <NativeSelect id="trackingType" name="trackingType" defaultValue={v("trackingType", base?.trackingType ?? "serialized")} disabled={hasItems}>
            {TRACKING_TYPES.map((tt) => (
              <option key={tt} value={tt}>
                {t(tt)}
              </option>
            ))}
          </NativeSelect>
          {hasItems && <input type="hidden" name="trackingType" value={base?.trackingType} />}
        </Field>
      </div>

      <Field id="description" label={t("description")} optional error={err.description}>
        <Textarea id="description" name="description" rows={3} defaultValue={v("description", base?.description)} />
      </Field>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-sm font-medium">{t("specs")}</legend>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field id="weightKg" label={t("weightKg")} optional error={err.weightKg}>
            <Input id="weightKg" name="weightKg" type="number" step="0.001" min="0" defaultValue={v("weightKg", base?.weightKg)} />
          </Field>
          <Field id="widthCm" label={`${t("widthCm")} (cm)`} optional error={err.widthCm}>
            <Input id="widthCm" name="widthCm" type="number" step="0.1" min="0" defaultValue={v("widthCm", base?.widthCm)} />
          </Field>
          <Field id="heightCm" label={`${t("heightCm")} (cm)`} optional error={err.heightCm}>
            <Input id="heightCm" name="heightCm" type="number" step="0.1" min="0" defaultValue={v("heightCm", base?.heightCm)} />
          </Field>
          <Field id="depthCm" label={`${t("depthCm")} (cm)`} optional error={err.depthCm}>
            <Input id="depthCm" name="depthCm" type="number" step="0.1" min="0" defaultValue={v("depthCm", base?.depthCm)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="powerDrawW" label={t("powerDrawW")} optional error={err.powerDrawW}>
            <Input id="powerDrawW" name="powerDrawW" type="number" step="1" min="0" defaultValue={v("powerDrawW", base?.powerDrawW)} />
          </Field>
          <Field id="rentalDayPrice" label={t("rentalDayPrice", { currency: appConfig.currency })} help={t("rentalDayPriceHelp")} optional error={err.rentalDayPrice}>
            <Input id="rentalDayPrice" name="rentalDayPrice" type="number" step="0.01" min="0" defaultValue={v("rentalDayPrice", base?.rentalDayPrice)} />
          </Field>
        </div>
        <Field id="linksText" label={t("links")} optional help={t("linksHelp")} error={err.linksText}>
          <Textarea id="linksText" name="linksText" rows={3} defaultValue={v("linksText", model ? linksToText(model.links) : "")} />
        </Field>
        <Field id="notes" label={tc("notes")} optional error={err.notes}>
          <Textarea id="notes" name="notes" rows={3} defaultValue={v("notes", base?.notes)} />
        </Field>
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="notForRental" className="mt-0.5 size-4" defaultChecked={state.values ? state.values.notForRental === "on" : Boolean(base?.notForRental)} />
        <span>
          {t("notForRental")}
          <span className="block text-xs text-muted-foreground">{t("notForRentalHelp")}</span>
        </span>
      </label>

      <fieldset className="flex flex-col gap-3 rounded-md border p-3">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consumable" className="mt-0.5 size-4" checked={consumable} onChange={(e) => setConsumable(e.target.checked)} />
          <span>
            {t("consumable")}
            <span className="block text-xs text-muted-foreground">{t("consumableHelp")}</span>
          </span>
        </label>
        {consumable && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="unit" label={t("unit")} help={unit === "m" ? t("unitMetresHelp") : t("unitPiecesHelp")} error={err.unit}>
              <NativeSelect id="unit" name="unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="pcs">{t("unitPcs")}</option>
                <option value="m">{t("unitM")}</option>
              </NativeSelect>
            </Field>
            <Field id="minStock" label={t("minStock")} help={t("minStockHelp")} optional error={err.minStock}>
              <Input id="minStock" name="minStock" type="number" min="0" step={unit === "m" ? "0.01" : "1"} defaultValue={v("minStock", base?.minStock)} />
            </Field>
          </div>
        )}
      </fieldset>

      <CustomFieldInputs defs={applicableDefs(defs, categoryId || null)} values={base?.customFields} echoed={state.values} errors={err} title={t("customFields")} />

      <div className="flex gap-2">
        <SubmitButton pendingText={tc("loading")}>{tc("save")}</SubmitButton>
        <Link href={model ? `/inventory/models/${model.id}` : "/inventory"} className={buttonVariants({ variant: "outline" })}>
          {tc("cancel")}
        </Link>
      </div>
    </ActionForm>
  );
}
