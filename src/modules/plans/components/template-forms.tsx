"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError, FormSuccess } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { LOGISTICS_KINDS, PLAN_ENTRY_KINDS, PLAN_PHASES } from "../../../../config/app.config";
import { deletePlanTemplate, removeTemplateEntry, savePlanTemplate, saveTemplateEntry } from "../actions";

export type TemplateEntryRow = { id: string; kind: string; dayOffset: number; time: string | null; durationMin: number | null; title: string; location: string | null; phase: string | null; logisticsKind: string | null; notes: string | null };

export function PlanTemplateDialog({ template, trigger }: { template?: { id: string; name: string; description: string | null }; trigger: "new" | "edit" }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(savePlanTemplate, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  return (
    <>
      <Button variant={trigger === "new" ? "default" : "outline"} size={trigger === "new" ? "default" : "sm"} onClick={() => setOpen(true)}>
        {trigger === "new" ? t("newTemplate") : tc("edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{template ? t("editTemplate") : t("newTemplate")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            {template && <input type="hidden" name="id" value={template.id} />}
            <FormError message={state.error} />
            <FormSuccess message={state.ok && template ? tc("saved") : undefined} />
            <Field id="pt-name" label={t("templateName")} error={err.name}>
              <Input id="pt-name" name="name" defaultValue={state.values?.name ?? template?.name ?? ""} required autoFocus />
            </Field>
            <Field id="pt-desc" label={t("description")} optional error={err.description}>
              <Textarea id="pt-desc" name="description" rows={2} defaultValue={state.values?.description ?? template?.description ?? ""} />
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

export function TemplateEntryDialog({ templateId, entry }: { templateId: string; entry?: TemplateEntryRow }) {
  const t = useTranslations("plans");
  const tp = useTranslations("planPhase");
  const tk = useTranslations("logisticsKind");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveTemplateEntry, {});
  const [open, setOpen] = useActionDialog(state);
  const [kind, setKind] = useState(state.values?.kind ?? entry?.kind ?? "schedule");
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | number | null | undefined) => (state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback));
  return (
    <>
      <Button size={entry ? "xs" : "default"} variant={entry ? "ghost" : "default"} onClick={() => setOpen(true)}>
        {entry ? tc("edit") : t("addTemplateEntry")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{entry ? t("editTemplateEntry") : t("addTemplateEntry")}</DialogTitle>
            <DialogDescription>{t("templateEntryHelp")}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="templateId" value={templateId} />
            {entry && <input type="hidden" name="id" value={entry.id} />}
            <FormError message={state.error} />
            <div className="grid grid-cols-2 gap-3">
              <Field id="te-kind" label={t("entryKind")} error={err.kind}>
                <NativeSelect id="te-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                  {PLAN_ENTRY_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`kind_${k}` as "kind_schedule")}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="te-offset" label={t("dayOffset")} help={t("dayOffsetHelp")} error={err.dayOffset}>
                <Input id="te-offset" name="dayOffset" type="number" step="1" defaultValue={v("dayOffset", entry?.dayOffset ?? 0)} />
              </Field>
            </div>
            <Field id="te-title" label={t("what")} error={err.title}>
              <Input id="te-title" name="title" defaultValue={v("title", entry?.title)} required autoFocus />
            </Field>
            {kind !== "task" && (
              <div className="grid grid-cols-2 gap-3">
                <Field id="te-time" label={t("time")} optional error={err.time}>
                  <Input id="te-time" name="time" type="time" defaultValue={v("time", entry?.time)} />
                </Field>
                {kind === "schedule" && (
                  <Field id="te-dur" label={t("durationMin")} optional error={err.durationMin}>
                    <Input id="te-dur" name="durationMin" type="number" min="0" step="15" defaultValue={v("durationMin", entry?.durationMin)} />
                  </Field>
                )}
              </div>
            )}
            {kind === "schedule" && (
              <Field id="te-loc" label={t("where")} optional error={err.location}>
                <Input id="te-loc" name="location" defaultValue={v("location", entry?.location)} />
              </Field>
            )}
            {kind === "task" && (
              <Field id="te-phase" label={t("phase")} error={err.phase}>
                <NativeSelect id="te-phase" name="phase" defaultValue={v("phase", entry?.phase ?? "pre_production")}>
                  {PLAN_PHASES.map((p) => (
                    <option key={p} value={p}>
                      {tp(p)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {kind === "logistics" && (
              <Field id="te-lkind" label={t("kind")} error={err.logisticsKind}>
                <NativeSelect id="te-lkind" name="logisticsKind" defaultValue={v("logisticsKind", entry?.logisticsKind ?? "vehicle")}>
                  {LOGISTICS_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {tk(k)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Field id="te-notes" label={t("notes")} optional error={err.notes}>
              <Textarea id="te-notes" name="notes" rows={2} defaultValue={v("notes", entry?.notes)} />
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

export function RemoveTemplateEntryButton({ templateId, id }: { templateId: string; id: string }) {
  const tc = useTranslations("common");
  return (
    <form action={removeTemplateEntry}>
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </Button>
    </form>
  );
}

export function DeletePlanTemplateButton({ id }: { id: string }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  return (
    <form action={deletePlanTemplate}>
      <input type="hidden" name="id" value={id} />
      <ConfirmButton confirm={t("deleteTemplateConfirm")} variant="ghost" size="sm" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
