"use client";

import { useActionState } from "react";
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

type ModelOption = { id: string; manufacturer: string; name: string; trackingType: string };

export type ReservationEdit = { id: string; modelId: string; quantity: number; startDate: string; endDate: string; note: string | null };

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
              <NativeSelect id="res-model" name="modelId" defaultValue={v("modelId", existing?.modelId)} required>
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
