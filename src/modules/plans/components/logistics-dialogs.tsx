"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { LOGISTICS_KINDS } from "../../../../config/app.config";
import { removeLogistics, saveLogistics } from "../actions";

type Ids = { projectId: string; planId: string };
export type LogisticsForm = { id: string; kind: string; title: string; details: string | null; at: string };

export function LogisticsDialog({ ids, entry }: { ids: Ids; entry?: LogisticsForm }) {
  const t = useTranslations("plans");
  const tk = useTranslations("logisticsKind");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveLogistics, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | null | undefined) => (state.values && name in state.values ? state.values[name] : (fallback ?? ""));
  return (
    <>
      <Button size={entry ? "xs" : "sm"} variant={entry ? "ghost" : "default"} onClick={() => setOpen(true)}>
        {entry ? tc("edit") : t("addLogistics")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{entry ? t("editLogistics") : t("addLogistics")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="projectId" value={ids.projectId} />
            <input type="hidden" name="planId" value={ids.planId} />
            {entry && <input type="hidden" name="id" value={entry.id} />}
            <FormError message={state.error} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr]">
              <Field id="lg-kind" label={t("kind")} error={err.kind}>
                <NativeSelect id="lg-kind" name="kind" defaultValue={v("kind", entry?.kind ?? "vehicle")}>
                  {LOGISTICS_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {tk(k)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="lg-title" label={t("what")} error={err.title}>
                <Input id="lg-title" name="title" defaultValue={v("title", entry?.title)} required autoFocus />
              </Field>
            </div>
            <Field id="lg-at" label={t("when")} optional error={err.at}>
              <Input id="lg-at" name="at" type="datetime-local" defaultValue={v("at", entry?.at)} />
            </Field>
            <Field id="lg-details" label={t("details")} optional help={t("logisticsHelp")} error={err.details}>
              <Textarea id="lg-details" name="details" rows={3} defaultValue={v("details", entry?.details)} />
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

export function RemoveLogisticsButton({ ids, id }: { ids: Ids; id: string }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  return (
    <form action={removeLogistics}>
      <input type="hidden" name="projectId" value={ids.projectId} />
      <input type="hidden" name="id" value={id} />
      <ConfirmButton confirm={t("removeLogisticsConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
