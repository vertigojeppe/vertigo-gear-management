"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/forms";
import { renameFamily } from "../actions";

/** Admin: rename a whole family (manufacturer + name) in one go; every variant follows. */
export function RenameFamilyDialog({ modelId, manufacturer, name, count }: { modelId: string; manufacturer: string; name: string; count: number }) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(renameFamily, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (field: string, fallback: string) => (state.values && field in state.values ? state.values[field] : fallback);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("renameFamily")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("renameFamily")}</DialogTitle>
            <DialogDescription>{t("renameFamilyHelp", { count })}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="modelId" value={modelId} />
            <FormError message={state.error} />
            <Field id="rf-manufacturer" label={t("manufacturer")} optional error={err.manufacturer}>
              <Input id="rf-manufacturer" name="manufacturer" defaultValue={v("manufacturer", manufacturer)} />
            </Field>
            <Field id="rf-name" label={t("modelName")} help={t("modelNameHelp")} error={err.name}>
              <Input id="rf-name" name="name" defaultValue={v("name", name)} required autoFocus />
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
