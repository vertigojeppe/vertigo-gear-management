"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/form/decimal-input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { savePurchase } from "../actions";
import type { PurchaseRow } from "../queries";

export type SupplierOption = { id: string; name: string; organisation: string | null };

export function PurchaseDialog({ modelId, purchase, suppliers, trigger }: { modelId: string; purchase?: PurchaseRow; suppliers: SupplierOption[]; trigger: "new" | "edit" }) {
  const t = useTranslations("purchases");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(savePurchase, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | number | null | undefined) =>
    state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback);
  return (
    <>
      <Button variant={trigger === "new" ? "outline" : "outline"} size={trigger === "new" ? "sm" : "sm"} onClick={() => setOpen(true)}>
        {trigger === "new" ? t("newPurchase") : tc("edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{purchase ? t("editPurchase") : t("newPurchase")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            {purchase && <input type="hidden" name="id" value={purchase.id} />}
            <input type="hidden" name="modelId" value={modelId} />
            <FormError message={state.error} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="p-supplier" label={t("supplier")} help={t("supplierHelp")} optional error={err.supplierContactId}>
                <NativeSelect id="p-supplier" name="supplierContactId" defaultValue={v("supplierContactId", purchase?.supplierContactId)}>
                  <option value="">—</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.organisation ? `${s.name} (${s.organisation})` : s.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="p-date" label={t("date")} optional error={err.date}>
                <Input id="p-date" name="date" type="date" defaultValue={v("date", purchase?.date)} />
              </Field>
              <Field id="p-reference" label={t("reference")} help={t("referenceHelp")} optional error={err.reference}>
                <Input id="p-reference" name="reference" defaultValue={v("reference", purchase?.reference)} autoFocus />
              </Field>
              <Field id="p-quantity" label={t("quantity")} error={err.quantity}>
                <Input id="p-quantity" name="quantity" type="number" min="1" step="1" defaultValue={v("quantity", purchase?.quantity ?? 1)} />
              </Field>
              <Field id="p-list" label={t("listPrice")} optional error={err.listPrice}>
                <DecimalInput id="p-list" name="listPrice" defaultValue={v("listPrice", purchase?.listPrice)} />
              </Field>
              <Field id="p-discount" label={t("discountPct")} optional error={err.discountPct}>
                <DecimalInput id="p-discount" name="discountPct" defaultValue={v("discountPct", purchase?.discountPct)} />
              </Field>
              <Field id="p-net" label={t("netPrice")} help={t("netPriceHelp")} optional error={err.netPrice} className="sm:col-span-2">
                <DecimalInput id="p-net" name="netPrice" defaultValue={v("netPrice", purchase?.netPrice)} />
              </Field>
            </div>
            <Field id="p-notes" label={t("notes")} optional error={err.notes}>
              <Textarea id="p-notes" name="notes" rows={3} defaultValue={v("notes", purchase?.notes)} />
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
