"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { ConfirmButton } from "@/components/form/confirm-button";
import { Field, FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { appConfig } from "../../../../config/app.config";
import { removeExtraLine, saveExtraLine, saveQuoteSettings } from "../actions";
import type { HolderKind } from "../service";

type TableOption = { id: string; name: string; isDefault: boolean };
type Holder = { kind: HolderKind; id: string };

export function QuoteSettingsDialog({ holder, tables, current, windowDays }: { holder: Holder; tables: TableOption[]; current: { rateTableId: string | null; chargeDays: number | null; discountPct: number | null; terms: string | null }; windowDays: number | null }) {
  const t = useTranslations("pricing");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveQuoteSettings, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | number | null | undefined) => (state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback));
  const def = tables.find((x) => x.isDefault);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("settings")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings")}</DialogTitle>
            <DialogDescription>{t("settingsHelp")}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="holderKind" value={holder.kind} />
            <input type="hidden" name="holderId" value={holder.id} />
            <FormError message={state.error} />
            <Field id="qs-table" label={t("rateTable")} error={err.rateTableId}>
              <NativeSelect id="qs-table" name="rateTableId" defaultValue={v("rateTableId", current.rateTableId)}>
                <option value="">{def ? t("defaultTable", { name: def.name }) : "—"}</option>
                {tables.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="qs-days" label={t("chargeDays")} help={windowDays ? t("chargeDaysHelp", { days: windowDays }) : undefined} optional error={err.chargeDays}>
                <Input id="qs-days" name="chargeDays" type="number" min="1" step="1" defaultValue={v("chargeDays", current.chargeDays)} placeholder={windowDays ? String(windowDays) : ""} />
              </Field>
              <Field id="qs-discount" label={t("documentDiscount")} optional error={err.discountPct}>
                <Input id="qs-discount" name="discountPct" type="number" min="0" max="100" step="0.01" defaultValue={v("discountPct", current.discountPct)} />
              </Field>
            </div>
            <Field id="qs-terms" label={t("terms")} help={t("termsHelp")} optional error={err.terms}>
              <Textarea id="qs-terms" name="terms" rows={3} defaultValue={v("terms", current.terms)} />
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

export type ExtraLineEdit = { id: string; description: string; quantity: number; unitPrice: number; discountPct: number | null };

export function ExtraLineDialog({ holder, existing }: { holder: Holder; existing?: ExtraLineEdit }) {
  const t = useTranslations("pricing");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveExtraLine, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | number | null | undefined) => (state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback));
  return (
    <>
      <Button variant={existing ? "ghost" : "outline"} size={existing ? "xs" : "sm"} onClick={() => setOpen(true)}>
        {existing ? tc("edit") : t("addExtraLine")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{existing ? t("editExtraLine") : t("addExtraLine")}</DialogTitle>
            <DialogDescription>{t("extraLineHelp")}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="holderKind" value={holder.kind} />
            <input type="hidden" name="holderId" value={holder.id} />
            {existing && <input type="hidden" name="lineId" value={existing.id} />}
            <FormError message={state.error} />
            <Field id="xl-desc" label={t("description")} error={err.description}>
              <Input id="xl-desc" name="description" defaultValue={v("description", existing?.description)} required autoFocus />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field id="xl-qty" label={t("quantity")} error={err.quantity}>
                <Input id="xl-qty" name="quantity" type="number" min="1" step="1" defaultValue={v("quantity", existing?.quantity ?? 1)} required />
              </Field>
              <Field id="xl-price" label={t("unitPrice", { currency: appConfig.currency })} error={err.unitPrice}>
                <Input id="xl-price" name="unitPrice" type="number" min="0" step="0.01" defaultValue={v("unitPrice", existing?.unitPrice)} required />
              </Field>
              <Field id="xl-disc" label={t("lineDiscount")} optional error={err.discountPct}>
                <Input id="xl-disc" name="discountPct" type="number" min="0" max="100" step="0.01" defaultValue={v("discountPct", existing?.discountPct)} />
              </Field>
            </div>
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

export function RemoveExtraLineButton({ holder, id }: { holder: Holder; id: string }) {
  const tc = useTranslations("common");
  return (
    <form action={removeExtraLine}>
      <input type="hidden" name="holderKind" value={holder.kind} />
      <input type="hidden" name="holderId" value={holder.id} />
      <input type="hidden" name="id" value={id} />
      <ConfirmButton confirm={tc("confirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
