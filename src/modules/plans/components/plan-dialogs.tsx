"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError, FormSuccess } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { ShareUrl } from "@/components/share-url";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { applyPlanTemplate, createPlan, createPlanShareLink, deletePlan, revokePlanShareLink, savePlanAsTemplate, updatePlanNotes } from "../actions";

type TemplateOption = { id: string; label: string };
type Ids = { projectId: string; planId: string };

function Hidden({ ids }: { ids: Ids }) {
  return (
    <>
      <input type="hidden" name="projectId" value={ids.projectId} />
      <input type="hidden" name="planId" value={ids.planId} />
    </>
  );
}

/** On the project page: start the plan, empty or from a template. */
export function CreatePlanDialog({ projectId, templates, defaultAnchor }: { projectId: string; templates: TemplateOption[]; defaultAnchor: string }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(createPlan, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {t("createPlan")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createPlan")}</DialogTitle>
            <DialogDescription>{t("createPlanHelp")}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="projectId" value={projectId} />
            <FormError message={state.error} />
            <Field id="cp-template" label={t("template")} optional error={err.templateId}>
              <NativeSelect id="cp-template" name="templateId" defaultValue={state.values?.templateId ?? ""}>
                <option value="">{t("emptyPlan")}</option>
                {templates.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="cp-anchor" label={t("anchorDate")} help={t("anchorHelp")} error={err.anchorDate}>
              <Input id="cp-anchor" name="anchorDate" type="date" defaultValue={state.values?.anchorDate ?? defaultAnchor} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <SubmitButton pendingText={tc("loading")}>{tc("create")}</SubmitButton>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ApplyPlanTemplateDialog({ ids, templates, defaultAnchor }: { ids: Ids; templates: TemplateOption[]; defaultAnchor: string }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(applyPlanTemplate, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {t("applyTemplate")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("applyTemplate")}</DialogTitle>
            <DialogDescription>{t("applyTemplateHelp")}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <Hidden ids={ids} />
            <FormError message={state.error} />
            <Field id="ap-template" label={t("template")} error={err.templateId}>
              <NativeSelect id="ap-template" name="templateId" defaultValue={state.values?.templateId ?? templates[0]?.id ?? ""} required>
                {templates.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="ap-anchor" label={t("anchorDate")} help={t("anchorHelp")} error={err.anchorDate}>
              <Input id="ap-anchor" name="anchorDate" type="date" defaultValue={state.values?.anchorDate ?? defaultAnchor} required />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <SubmitButton pendingText={tc("loading")}>{tc("add")}</SubmitButton>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SavePlanAsTemplateDialog({ ids, defaultName, defaultAnchor }: { ids: Ids; defaultName: string; defaultAnchor: string }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(savePlanAsTemplate, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {t("saveAsTemplate")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("saveAsTemplate")}</DialogTitle>
            <DialogDescription>{t("saveAsTemplateHelp")}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <Hidden ids={ids} />
            <FormError message={state.error} />
            <FormSuccess message={state.ok ? tc("saved") : undefined} />
            <Field id="st-name" label={t("templateName")} error={err.name}>
              <Input id="st-name" name="name" defaultValue={state.values?.name ?? defaultName} required autoFocus />
            </Field>
            <Field id="st-anchor" label={t("anchorDate")} help={t("anchorHelp")} error={err.anchorDate}>
              <Input id="st-anchor" name="anchorDate" type="date" defaultValue={state.values?.anchorDate ?? defaultAnchor} required />
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

export function DeletePlanButton({ ids }: { ids: Ids }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  return (
    <form action={deletePlan}>
      <Hidden ids={ids} />
      <ConfirmButton confirm={t("deleteConfirm")} size="sm" variant="ghost" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}

export function PlanShareControls({ ids, path }: { ids: Ids; path: string | null }) {
  const t = useTranslations("plans");
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
      <div>
        <p className="font-medium">{t("share")}</p>
        <p className="text-xs text-muted-foreground">{t("shareHelp")}</p>
      </div>
      {path ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <ShareUrl path={path} />
          <form action={revokePlanShareLink}>
            <Hidden ids={ids} />
            <ConfirmButton confirm={t("revokeShare") + "?"} size="xs" variant="ghost" className="text-destructive">
              {t("revokeShare")}
            </ConfirmButton>
          </form>
        </div>
      ) : (
        <form action={createPlanShareLink}>
          <Hidden ids={ids} />
          <Button type="submit" size="sm" variant="outline">
            {t("createShare")}
          </Button>
        </form>
      )}
    </div>
  );
}

export function PlanNotesForm({ ids, notes }: { ids: Ids; notes: string | null }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(updatePlanNotes, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-2">
      <Hidden ids={ids} />
      <FormError message={state.error} />
      <Field id="plan-notes" label={t("notes")} optional error={state.fieldErrors?.notes}>
        <Textarea id="plan-notes" name="notes" rows={4} defaultValue={state.values?.notes ?? notes ?? ""} />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton size="sm" variant="outline" pendingText={tc("loading")}>
          {tc("save")}
        </SubmitButton>
        {state.ok && <span className="text-xs text-muted-foreground">{tc("saved")}</span>}
      </div>
    </ActionForm>
  );
}
