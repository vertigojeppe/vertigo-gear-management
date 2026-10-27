"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/form/action-form";
import { useTranslations } from "next-intl";
import { Field, FormError } from "@/components/form/field";
import { ModelSelect } from "@/components/form/model-select";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/form/decimal-input";
import type { FormState } from "@/lib/forms";
import { ConflictNotice } from "@/components/conflict-notice";
import { appConfig } from "../../../../config/app.config";
import { assignRentalItem, removeRentalLine, saveRentalLine, type LineState } from "../actions";

type ModelOption = { id: string; manufacturer: string; name: string; variant?: string | null; trackingType: string; rentalDayPrice?: number | null };
type LineEdit = { id: string; modelId: string; quantity: number; pricePerDay: number | null; discountPct: number | null; note: string | null };

export function RentalLineDialog({ rentalId, models, existing }: { rentalId: string; models: ModelOption[]; existing?: LineEdit }) {
  const t = useTranslations("rentals");
  const tc = useTranslations("common");
  const [state, action] = useActionState<LineState, FormData>(saveRentalLine, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | number | null | undefined) =>
    state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback);
  const currency = appConfig.currency;
  const conflict = state.data?.conflict;
  const [modelId, setModelId] = useState(v("modelId", existing?.modelId));
  const [price, setPrice] = useState(v("pricePerDay", existing?.pricePerDay));
  const pickModel = (id: string) => {
    setModelId(id);
    if (!existing) setPrice(String(models.find((m) => m.id === id)?.rentalDayPrice ?? ""));
  };
  return (
    <>
      <Button variant={existing ? "ghost" : "default"} size={existing ? "xs" : "sm"} onClick={() => setOpen(true)}>
        {existing ? tc("edit") : t("addLine")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{existing ? t("editLine") : t("addLine")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="rentalId" value={rentalId} />
            {existing && <input type="hidden" name="lineId" value={existing.id} />}
            <FormError message={state.error} />
            <Field id="line-model" label={t("model")} error={err.modelId}>
              <ModelSelect id="line-model" name="modelId" value={modelId} onChange={(e) => pickModel(e.target.value)} models={models} required />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field id="line-qty" label={t("quantity")} error={err.quantity}>
                <Input id="line-qty" name="quantity" type="number" min="1" step="1" defaultValue={v("quantity", existing?.quantity ?? 1)} required />
              </Field>
              <Field id="line-day" label={t("pricePerDay", { currency })} optional error={err.pricePerDay}>
                <DecimalInput id="line-day" name="pricePerDay" value={price} onChange={(e) => setPrice(e.target.value)} />
              </Field>
              <Field id="line-disc" label={t("lineDiscount")} optional error={err.discountPct}>
                <DecimalInput id="line-disc" name="discountPct" defaultValue={v("discountPct", existing?.discountPct)} />
              </Field>
            </div>
            <Field id="line-note" label={t("note")} optional error={err.note}>
              <Input id="line-note" name="note" defaultValue={v("note", existing?.note)} />
            </Field>
            {conflict && (
              <>
                <ConflictNotice conflict={conflict} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="force" className="size-4" />
                  {t("reserveAnyway")}
                </label>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <SubmitButton pendingText={tc("loading")}>{tc("save")}</SubmitButton>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AssignUnitForm({ rentalId, lineId, current, units }: { rentalId: string; lineId: string; current: string | null; units: { id: string; label: string }[] }) {
  const t = useTranslations("rentals");
  const [state, action] = useActionState<FormState, FormData>(assignRentalItem, {});
  return (
    <ActionForm action={action} className="flex items-center gap-1">
      <input type="hidden" name="rentalId" value={rentalId} />
      <input type="hidden" name="lineId" value={lineId} />
      <NativeSelect name="itemId" defaultValue={current ?? ""} aria-label={t("assignUnit")} className="h-7 w-52 text-xs">
        <option value="">{t("noUnit")}</option>
        {current && !units.some((u) => u.id === current) && <option value={current}>{t("unit")}</option>}
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </NativeSelect>
      <SubmitButton size="xs" variant="outline">
        {t("assignUnit")}
      </SubmitButton>
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
      {state.fieldErrors?.itemId && <span className="text-xs text-destructive">{state.fieldErrors.itemId}</span>}
    </ActionForm>
  );
}

export function RemoveLineButton({ id, rentalId }: { id: string; rentalId: string }) {
  const tc = useTranslations("common");
  return (
    <form action={removeRentalLine}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="rentalId" value={rentalId} />
      <ConfirmButton confirm={tc("confirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
