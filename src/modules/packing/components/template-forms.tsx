"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError, FormSuccess } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { deleteTemplate, removeTemplateLine, saveTemplate } from "../actions";


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
