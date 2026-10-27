"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/form/decimal-input";
import type { FormState } from "@/lib/forms";
import { removeSubHireLine, saveSubHireLine } from "../actions";
import type { SubHireLineRow, SubHireOption } from "../queries";

/** "Rent in" / "Edit" dialog for a sub-hire line on a project. */
export function RentInDialog({ projectId, options, defaultFrom, defaultTo, existing }: { projectId: string; options: SubHireOption[]; defaultFrom: string | null; defaultTo: string | null; existing?: SubHireLineRow }) {
  const t = useTranslations("subhire");
  const tp = useTranslations("projects");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveSubHireLine, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | number | null | undefined) =>
    state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback);
  const [itemId, setItemId] = useState(v("subHireItemId", existing?.subHireItemId));
  const [cost, setCost] = useState(v("costPerDay", existing?.costPerDay));
  const [price, setPrice] = useState(v("pricePerDay", existing?.pricePerDay));
  const pick = (id: string) => {
    setItemId(id);
    // A new line starts from the catalog item's cost and price; an edit keeps what was typed.
    if (!existing) {
      const o = options.find((x) => x.id === id);
      setCost(o?.costPerDay === null || o?.costPerDay === undefined ? "" : String(o.costPerDay));
      setPrice(o?.rentalDayPrice ?? o?.costPerDay ? String(o?.rentalDayPrice ?? o?.costPerDay) : "");
    }
  };
  const owners = [...new Set(options.map((o) => o.ownerName))];
  return (
    <>
      <Button variant={existing ? "ghost" : "outline"} size={existing ? "xs" : "sm"} onClick={() => setOpen(true)}>
        {existing ? tc("edit") : t("rentIn")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{existing ? t("editLine") : t("rentIn")}</DialogTitle>
            <DialogDescription>{t("rentInHelp")}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="projectId" value={projectId} />
            {existing && <input type="hidden" name="lineId" value={existing.id} />}
            <FormError message={state.error} />
            <Field id="sh-line-item" label={t("item")} error={err.subHireItemId}>
              <NativeSelect id="sh-line-item" name="subHireItemId" value={itemId} onChange={(e) => pick(e.target.value)} required disabled={Boolean(existing)}>
                <option value="">—</option>
                {owners.map((owner) => (
                  <optgroup key={owner} label={owner}>
                    {options
                      .filter((o) => o.ownerName === owner)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </NativeSelect>
              {existing && <input type="hidden" name="subHireItemId" value={existing.subHireItemId} />}
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field id="sh-line-qty" label={tp("quantity")} error={err.quantity}>
                <Input id="sh-line-qty" name="quantity" type="number" min="1" step="1" defaultValue={v("quantity", existing?.quantity ?? 1)} required />
              </Field>
              <Field id="sh-line-from" label={tp("from")} error={err.startDate}>
                <Input id="sh-line-from" name="startDate" type="date" defaultValue={v("startDate", existing?.startDate ?? defaultFrom)} required />
              </Field>
              <Field id="sh-line-to" label={tp("to")} error={err.endDate}>
                <Input id="sh-line-to" name="endDate" type="date" defaultValue={v("endDate", existing?.endDate ?? defaultTo)} required />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field id="sh-line-cost" label={t("costPerDay")} optional error={err.costPerDay}>
                <DecimalInput id="sh-line-cost" name="costPerDay" value={cost} onChange={(e) => setCost(e.target.value)} />
              </Field>
              <Field id="sh-line-price" label={tp("dayPrice")} optional error={err.pricePerDay}>
                <DecimalInput id="sh-line-price" name="pricePerDay" value={price} onChange={(e) => setPrice(e.target.value)} />
              </Field>
              <Field id="sh-line-disc" label={tp("lineDiscount")} optional error={err.discountPct}>
                <DecimalInput id="sh-line-disc" name="discountPct" defaultValue={v("discountPct", existing?.discountPct)} />
              </Field>
            </div>
            <Field id="sh-line-note" label={tp("note")} optional error={err.note}>
              <Input id="sh-line-note" name="note" defaultValue={v("note", existing?.note)} />
            </Field>
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

export function RemoveSubHireLineButton({ id, projectId }: { id: string; projectId: string }) {
  const t = useTranslations("subhire");
  const tc = useTranslations("common");
  return (
    <form action={removeSubHireLine}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="projectId" value={projectId} />
      <ConfirmButton confirm={t("removeLineConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
