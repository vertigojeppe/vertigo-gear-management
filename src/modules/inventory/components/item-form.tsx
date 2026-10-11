"use client";

import { useActionState, useState } from "react";
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
import { appConfig } from "../../../../config/app.config";
import { createItems, updateItem } from "../actions";
import type { ItemDto } from "../service";

type ModelOption = { id: string; manufacturer: string; name: string; trackingType: string };
type LocationOption = { id: string; name: string; depth: number };

export function ItemForm({
  item,
  models,
  locations,
  defs,
  defaultModelId,
  canSeeFinance,
}: {
  item?: ItemDto;
  models: ModelOption[];
  locations: LocationOption[];
  defs: CustomFieldDef[];
  defaultModelId?: string;
  canSeeFinance: boolean;
}) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(item ? updateItem : createItems, {});
  const v = (name: string, fallback: string | number | null | undefined) =>
    state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback);
  const err = state.fieldErrors ?? {};

  const [modelId, setModelId] = useState(v("modelId", item?.modelId ?? defaultModelId));
  const [isKit, setIsKit] = useState(state.values ? state.values.isKit === "on" : Boolean(item?.isKit));
  const [count, setCount] = useState(Number(v("count", 1)) || 1);
  const model = models.find((m) => m.id === modelId);
  const bulk = model?.trackingType === "bulk";
  const currency = appConfig.currency;

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-6">
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormError message={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="modelId" label={t("model")} error={err.modelId} className="sm:col-span-2">
          <NativeSelect id="modelId" name="modelId" value={modelId} onChange={(e) => setModelId(e.target.value)} required>
            <option value="">—</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.manufacturer} {m.name} ({t(m.trackingType === "bulk" ? "bulk" : "serialized")})
              </option>
            ))}
          </NativeSelect>
        </Field>

        {bulk ? (
          <Field id="quantity" label={t("quantity")} error={err.quantity}>
            <Input id="quantity" name="quantity" type="number" min="0" step="1" defaultValue={v("quantity", item?.quantity ?? 1)} required />
          </Field>
        ) : item ? (
          <Field id="serialNumber" label={t("serialNumber")} optional error={err.serialNumber}>
            <Input id="serialNumber" name="serialNumber" defaultValue={v("serialNumber", item?.serialNumber)} />
          </Field>
        ) : (
          <>
            <Field id="count" label={t("count")} help={t("countHelp")} error={err.count}>
              <Input id="count" name="count" type="number" min="1" max="200" step="1" value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
            </Field>
            {count === 1 ? (
              <Field id="serialNumber" label={t("serialNumber")} optional error={err.serialNumber}>
                <Input id="serialNumber" name="serialNumber" defaultValue={v("serialNumber", "")} />
              </Field>
            ) : (
              <Field id="serialNumbers" label={t("serialNumbers")} optional help={t("serialNumbersHelp")} error={err.serialNumbers}>
                <Textarea id="serialNumbers" name="serialNumbers" rows={Math.min(count, 8)} defaultValue={v("serialNumbers", "")} />
              </Field>
            )}
          </>
        )}

        <Field id="locationId" label={t("location")} optional error={err.locationId}>
          <NativeSelect id="locationId" name="locationId" defaultValue={v("locationId", item?.locationId)}>
            <option value="">{t("noLocation")}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {"  ".repeat(l.depth)}
                {l.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      {!bulk && (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="isKit" className="mt-0.5 size-4" checked={isKit} onChange={(e) => setIsKit(e.target.checked)} />
            <span>
              {t("isKit")}
              <span className="block text-xs text-muted-foreground">{t("isKitHelp")}</span>
            </span>
          </label>
          {isKit && (
            <Field id="name" label={t("kitName")} error={err.name}>
              <Input id="name" name="name" defaultValue={v("name", item?.name)} required />
            </Field>
          )}
        </div>
      )}
      {!isKit && (
        <Field id="name" label={tc("name")} optional error={err.name}>
          <Input id="name" name="name" defaultValue={v("name", item?.name)} />
        </Field>
      )}

      {canSeeFinance && (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 text-sm font-medium">{t("finance")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="purchaseDate" label={t("purchaseDate")} optional error={err.purchaseDate}>
              <Input id="purchaseDate" name="purchaseDate" type="date" defaultValue={v("purchaseDate", item?.purchaseDate)} />
            </Field>
            <Field id="supplier" label={t("supplier")} optional error={err.supplier}>
              <Input id="supplier" name="supplier" defaultValue={v("supplier", item?.supplier)} />
            </Field>
            <Field id="purchasePrice" label={t("purchasePrice", { currency })} optional error={err.purchasePrice}>
              <Input id="purchasePrice" name="purchasePrice" type="number" step="0.01" min="0" defaultValue={v("purchasePrice", item?.purchasePrice)} />
            </Field>
            <Field id="insuredValue" label={t("insuredValue", { currency })} optional error={err.insuredValue}>
              <Input id="insuredValue" name="insuredValue" type="number" step="0.01" min="0" defaultValue={v("insuredValue", item?.insuredValue)} />
            </Field>
            <Field id="replacementValue" label={t("replacementValue", { currency })} optional error={err.replacementValue}>
              <Input id="replacementValue" name="replacementValue" type="number" step="0.01" min="0" defaultValue={v("replacementValue", item?.replacementValue)} />
            </Field>
          </div>
        </fieldset>
      )}

      <Field id="conditionNotes" label={t("conditionNotes")} optional error={err.conditionNotes}>
        <Textarea id="conditionNotes" name="conditionNotes" rows={2} defaultValue={v("conditionNotes", item?.conditionNotes)} />
      </Field>
      <Field id="notes" label={tc("notes")} optional error={err.notes}>
        <Textarea id="notes" name="notes" rows={2} defaultValue={v("notes", item?.notes)} />
      </Field>

      <CustomFieldInputs defs={defs} values={item?.customFields} echoed={state.values} errors={err} title={t("customFields")} />

      <div className="flex gap-2">
        <SubmitButton pendingText={tc("loading")}>{item ? tc("save") : tc("create")}</SubmitButton>
        <Link href={item ? `/inventory/items/${item.id}` : modelId ? `/inventory/models/${modelId}` : "/inventory/items"} className={buttonVariants({ variant: "outline" })}>
          {tc("cancel")}
        </Link>
      </div>
    </form>
  );
}
