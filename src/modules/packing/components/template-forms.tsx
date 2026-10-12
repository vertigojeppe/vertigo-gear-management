"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError, FormSuccess } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { addTemplateLine, deleteTemplate, removeTemplateLine, saveTemplate } from "../actions";

type ModelOption = { id: string; manufacturer: string; name: string; trackingType: string };

export function TemplateDialog({ template, trigger }: { template?: { id: string; name: string; description: string | null }; trigger: "new" | "edit" }) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveTemplate, {});
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
            <Field id="tp-name" label={t("name")} error={err.name}>
              <Input id="tp-name" name="name" defaultValue={state.values?.name ?? template?.name ?? ""} required autoFocus />
            </Field>
            <Field id="tp-desc" label={t("description")} optional error={err.description}>
              <Textarea id="tp-desc" name="description" rows={2} defaultValue={state.values?.description ?? template?.description ?? ""} />
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

export function TemplateLineForm({ templateId, models }: { templateId: string; models: ModelOption[] }) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(addTemplateLine, {});
  const err = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
      <input type="hidden" name="templateId" value={templateId} />
      <Field id="tl-model" label={t("model")} error={err.modelId} className="min-w-64 flex-1">
        <NativeSelect id="tl-model" name="modelId" defaultValue="" required>
          <option value="">—</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.manufacturer} {m.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field id="tl-qty" label={t("quantity")} error={err.quantity} className="w-24">
        <Input id="tl-qty" name="quantity" type="number" min="1" step="1" defaultValue="1" />
      </Field>
      <Field id="tl-note" label={t("note")} optional error={err.note} className="min-w-40 flex-1">
        <Input id="tl-note" name="note" />
      </Field>
      <SubmitButton variant="outline" pendingText={tc("loading")}>
        {tc("add")}
      </SubmitButton>
      {state.error && <p className="w-full text-xs text-destructive">{state.error}</p>}
    </ActionForm>
  );
}

export function RemoveTemplateLineButton({ templateId, lineId }: { templateId: string; lineId: string }) {
  const tc = useTranslations("common");
  return (
    <form action={removeTemplateLine}>
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="lineId" value={lineId} />
      <Button type="submit" variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </Button>
    </form>
  );
}

export function DeleteTemplateButton({ id }: { id: string }) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  return (
    <form action={deleteTemplate}>
      <input type="hidden" name="id" value={id} />
      <ConfirmButton confirm={t("deleteTemplateConfirm")} variant="ghost" size="sm" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
