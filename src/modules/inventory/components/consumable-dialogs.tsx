"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { ConfirmButton } from "@/components/form/confirm-button";
import { Field, FormError } from "@/components/form/field";
import { ModelSelect, type ModelChoice } from "@/components/form/model-select";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/form/decimal-input";
import type { FormState } from "@/lib/forms";
import { addPartFit, countConsumable, receiveConsumable, removePartFit, useConsumable } from "../actions";

type ProjectChoice = { id: string; name: string };

/** "Use": take pieces or metres off the shelf, optionally into a unit and on a project. */
export function UseConsumableDialog({ modelId, unit, projects }: { modelId: string; unit: string; projects: ProjectChoice[] }) {
  const t = useTranslations("consumables");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(useConsumable, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback = "") => (state.values && name in state.values ? state.values[name] : fallback);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {t("use")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("useTitle")}</DialogTitle>
            <DialogDescription>{t("useHelp")}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="modelId" value={modelId} />
            <FormError message={state.error} />
            <Field id="cu-qty" label={unit === "m" ? t("metres") : t("pieces")} error={err.quantity}>
              <DecimalInput id="cu-qty" name="quantity" defaultValue={v("quantity", "1")} required autoFocus />
            </Field>
            <Field id="cu-tag" label={t("intoUnit")} help={t("intoUnitHelp")} optional error={err.itemTag}>
              <Input id="cu-tag" name="itemTag" placeholder="VG-0123" defaultValue={v("itemTag")} />
            </Field>
            <Field id="cu-project" label={t("onProject")} optional error={err.projectId}>
              <NativeSelect id="cu-project" name="projectId" defaultValue={v("projectId")}>
                <option value="">—</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="cu-note" label={t("note")} optional error={err.note}>
              <Input id="cu-note" name="note" defaultValue={v("note")} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <SubmitButton pendingText={tc("loading")}>{t("use")}</SubmitButton>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Metres in ("received a 50 m reel") or a stocktake ("counted 12,5 m"). */
export function MetresDialog({ modelId, mode }: { modelId: string; mode: "receive" | "count" }) {
  const t = useTranslations("consumables");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(mode === "receive" ? receiveConsumable : countConsumable, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback = "") => (state.values && name in state.values ? state.values[name] : fallback);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {mode === "receive" ? t("receive") : t("count")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "receive" ? t("receiveTitle") : t("countTitle")}</DialogTitle>
            <DialogDescription>{mode === "receive" ? t("receiveHelp") : t("countHelp")}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="modelId" value={modelId} />
            <FormError message={state.error} />
            <Field id={`cm-${mode}-qty`} label={t("metres")} error={err.quantity}>
              <DecimalInput id={`cm-${mode}-qty`} name="quantity" defaultValue={v("quantity")} required autoFocus />
            </Field>
            <Field id={`cm-${mode}-note`} label={t("note")} optional error={err.note}>
              <Input id={`cm-${mode}-note`} name="note" defaultValue={v("note")} />
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

/** "Fits": link the part to a model with the spare rule. */
export function AddFitForm({ partId, models }: { partId: string; models: ModelChoice[] }) {
  const t = useTranslations("consumables");
  const [state, action] = useActionState<FormState, FormData>(addPartFit, {});
  const err = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="flex flex-wrap items-end gap-2 text-sm">
      <input type="hidden" name="partId" value={partId} />
      <label className="flex min-w-56 flex-1 flex-col gap-1">
        <span className="text-xs text-muted-foreground">{t("fitsModel")}</span>
        <ModelSelect name="modelId" models={models} required aria-label={t("fitsModel")} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{t("perUnits")}</span>
        <Input name="perUnits" type="number" min="1" step="1" defaultValue="4" className="w-20" aria-label={t("perUnits")} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{t("minQty")}</span>
        <Input name="minQty" type="number" min="0" step="1" defaultValue="1" className="w-20" aria-label={t("minQty")} />
      </label>
      <SubmitButton variant="outline" size="sm">
        {t("addFit")}
      </SubmitButton>
      <FormError message={state.error ?? err.modelId ?? err.perUnits} />
    </ActionForm>
  );
}

export function RemoveFitButton({ id }: { id: string }) {
  const t = useTranslations("consumables");
  const tc = useTranslations("common");
  return (
    <form action={removePartFit}>
      <input type="hidden" name="id" value={id} />
      <ConfirmButton confirm={t("removeFitConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
