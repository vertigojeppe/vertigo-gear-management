"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/form/action-form";
import { useTranslations } from "next-intl";
import { Field, FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { reserve, type ReserveState } from "../actions";
import { ConflictNotice } from "@/components/conflict-notice";

type ModelOption = { id: string; manufacturer: string; name: string; trackingType: string; rentalDayPrice?: number | null };

export type ReservationEdit = { id: string; modelId: string; quantity: number; startDate: string; endDate: string; note: string | null; pricePerDay: number | null; discountPct: number | null };

/** "Reserve gear" / "Edit reservation" dialog with conflict warning + override. */
export function ReserveDialog({
  projectId,
  models,
  defaultFrom,
  defaultTo,
  existing,
}: {
  projectId: string;
  models: ModelOption[];
  defaultFrom: string | null;
  defaultTo: string | null;
  existing?: ReservationEdit;
}) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const [state, action] = useActionState<ReserveState, FormData>(reserve, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | number | null | undefined) =>
    state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback);
  const conflict = state.data?.conflict;
  const [modelId, setModelId] = useState(v("modelId", existing?.modelId));
  const [price, setPrice] = useState(v("pricePerDay", existing?.pricePerDay));
  const pickModel = (id: string) => {
    setModelId(id);
    // A new reservation starts from the model's list day price; an edit keeps what was typed.
    if (!existing) setPrice(String(models.find((m) => m.id === id)?.rentalDayPrice ?? ""));
  };

  return (
    <>
      <Button variant={existing ? "ghost" : "default"} size={existing ? "xs" : "sm"} onClick={() => setOpen(true)}>
        {existing ? tc("edit") : t("reserve")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{existing ? t("editReservation") : t("reserve")}</DialogTitle>
            <DialogDescription>{t("reservationsHelp")}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="projectId" value={projectId} />
            {existing && <input type="hidden" name="allocationId" value={existing.id} />}
            <FormError message={state.error} />
            <Field id="res-model" label={t("model")} error={err.modelId}>
              <NativeSelect id="res-model" name="modelId" value={modelId} onChange={(e) => pickModel(e.target.value)} required>
                <option value="">—</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.manufacturer} {m.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field id="res-qty" label={t("quantity")} error={err.quantity}>
                <Input id="res-qty" name="quantity" type="number" min="1" step="1" defaultValue={v("quantity", existing?.quantity ?? 1)} required />
              </Field>
              <Field id="res-from" label={t("from")} error={err.startDate}>
                <Input id="res-from" name="startDate" type="date" defaultValue={v("startDate", existing?.startDate ?? defaultFrom)} required />
              </Field>
              <Field id="res-to" label={t("to")} error={err.endDate}>
                <Input id="res-to" name="endDate" type="date" defaultValue={v("endDate", existing?.endDate ?? defaultTo)} required />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field id="res-price" label={t("dayPrice")} help={t("dayPriceHelp")} optional error={err.pricePerDay}>
                <Input id="res-price" name="pricePerDay" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
              </Field>
              <Field id="res-disc" label={t("lineDiscount")} optional error={err.discountPct}>
                <Input id="res-disc" name="discountPct" type="number" min="0" max="100" step="0.01" defaultValue={v("discountPct", existing?.discountPct)} />
              </Field>
            </div>
            <Field id="res-note" label={t("note")} optional error={err.note}>
              <Input id="res-note" name="note" defaultValue={v("note", existing?.note)} />
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
