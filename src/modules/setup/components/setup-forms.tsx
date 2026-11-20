"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { ConfirmButton } from "@/components/form/confirm-button";
import { DecimalInput } from "@/components/form/decimal-input";
import { Field, FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { SETUP_CONDITIONS, SETUP_PHASES } from "../../../../config/app.config";
import { addSetupRecord, deleteInstallationType, removeSetupRecord, saveInstallationType } from "../actions";
import type { InstallationTypeRow } from "../queries";

const text = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

/** New installation type, or edit one and its rule of thumb. */
export function InstallationTypeDialog({ type }: { type?: InstallationTypeRow }) {
  const t = useTranslations("setup");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveInstallationType, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: number | string | null | undefined) => (state.values && name in state.values ? state.values[name] : text(fallback));
  return (
    <>
      <Button variant={type ? "outline" : "default"} onClick={() => setOpen(true)}>
        {type ? t("editType") : t("newType")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{type ? t("editType") : t("newType")}</DialogTitle>
            <DialogDescription>{t("typeHelp")}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            {type && <input type="hidden" name="id" value={type.id} />}
            <FormError message={state.error} />
            <Field id="it-name" label={t("typeName")} error={err.name}>
              <Input id="it-name" name="name" defaultValue={v("name", type?.name)} placeholder={t("typeNameExample")} required autoFocus />
            </Field>
            <Field id="it-desc" label={t("description")} optional error={err.description}>
              <Textarea id="it-desc" name="description" rows={2} defaultValue={v("description", type?.description)} />
            </Field>
            <fieldset className="flex flex-col gap-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">{t("rule")}</legend>
              <p className="text-xs text-muted-foreground">{t("ruleHelp")}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field id="it-base" label={t("baseHours")} optional error={err.baseHours}>
                  <DecimalInput id="it-base" name="baseHours" defaultValue={v("baseHours", type?.baseHours)} />
                </Field>
                <Field id="it-crew" label={t("ruleCrewLabel")} optional error={err.ruleCrew}>
                  <Input id="it-crew" name="ruleCrew" type="number" min={1} defaultValue={v("ruleCrew", type?.ruleCrew)} />
                </Field>
                <Field id="it-per" label={t("minutesPerUnit")} optional error={err.minutesPerUnit}>
                  <DecimalInput id="it-per" name="minutesPerUnit" defaultValue={v("minutesPerUnit", type?.minutesPerUnit)} />
                </Field>
                <Field id="it-unit" label={t("unitName")} optional error={err.unitName}>
                  <Input id="it-unit" name="unitName" defaultValue={v("unitName", type?.unitName)} placeholder={t("unitNameExample")} />
                </Field>
              </div>
              <Field id="it-notes" label={t("ruleNotes")} optional error={err.ruleNotes}>
                <Textarea id="it-notes" name="ruleNotes" rows={2} defaultValue={v("ruleNotes", type?.ruleNotes)} placeholder={t("ruleNotesExample")} />
              </Field>
            </fieldset>
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

export function DeleteInstallationTypeButton({ id }: { id: string }) {
  const t = useTranslations("setup");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(deleteInstallationType, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <ConfirmButton confirm={t("deleteTypeConfirm")} variant="outline" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
      <FormError message={state.error} />
    </ActionForm>
  );
}

/** A job from before the system, as remembered: phase, how much, how many people, how long, what made it harder. */
export function SetupRecordDialog({ type }: { type: InstallationTypeRow }) {
  const t = useTranslations("setup");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(addSetupRecord, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string) => state.values?.[name] ?? "";
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("addRecord")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addRecord")}</DialogTitle>
            <DialogDescription>{t("recordHelp")}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="typeId" value={type.id} />
            <FormError message={state.error} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="sr-phase" label={t("phase")} error={err.phase}>
                <NativeSelect id="sr-phase" name="phase" defaultValue={v("phase") || "build"}>
                  {SETUP_PHASES.map((p) => (
                    <option key={p} value={p}>
                      {t(`phase_${p}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="sr-period" label={t("period")} optional error={err.period}>
                <Input id="sr-period" name="period" defaultValue={v("period")} placeholder={t("periodExample")} />
              </Field>
              <Field id="sr-units" label={type.unitName ? t("unitsOf", { unit: type.unitName }) : t("units")} optional error={err.units}>
                <Input id="sr-units" name="units" type="number" min={1} defaultValue={v("units")} />
              </Field>
              <Field id="sr-crew" label={t("crew")} optional error={err.crew}>
                <Input id="sr-crew" name="crew" type="number" min={1} defaultValue={v("crew")} />
              </Field>
              <Field id="sr-hours" label={t("hours")} error={err.hours}>
                <DecimalInput id="sr-hours" name="hours" defaultValue={v("hours")} required />
              </Field>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("conditions")}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {SETUP_CONDITIONS.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="conditions" value={c} className="size-4" />
                    {t(`condition_${c}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field id="sr-lesson" label={t("lesson")} optional error={err.lesson}>
              <Textarea id="sr-lesson" name="lesson" rows={3} defaultValue={v("lesson")} placeholder={t("lessonExample")} />
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

export function RemoveSetupRecordButton({ id }: { id: string }) {
  const t = useTranslations("setup");
  const tc = useTranslations("common");
  return (
    <form action={removeSetupRecord}>
      <input type="hidden" name="id" value={id} />
      <ConfirmButton confirm={t("removeRecordConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
