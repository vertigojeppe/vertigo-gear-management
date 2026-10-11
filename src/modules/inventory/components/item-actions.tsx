"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/form/action-form";
import { useTranslations } from "next-intl";
import { Field, FormError } from "@/components/form/field";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { ITEM_STATUSES } from "../../../../config/app.config";
import { changeItemStatus, moveItem } from "../actions";

type LocationOption = { id: string; name: string; depth: number };

/** "Change status" button + dialog. */
export function StatusDialog({ itemId, current, isKit, locations }: { itemId: string; current: string; isKit: boolean; locations: LocationOption[] }) {
  const t = useTranslations("inventory");
  const ts = useTranslations("itemStatus");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(changeItemStatus, {});
  const [status, setStatus] = useState(current);
  const def = ITEM_STATUSES.find((s) => s.key === status);

  const [open, setOpen] = useActionDialog(state);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("changeStatus")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("changeStatus")}</DialogTitle>
            {isKit && <DialogDescription>{t("cascadeNote")}</DialogDescription>}
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={itemId} />
            <FormError message={state.error} />
            <Field id="status" label={t("newStatus")} error={state.fieldErrors?.status}>
              <NativeSelect id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {ITEM_STATUSES.filter((s) => s.manual).map((s) => (
                  <option key={s.key} value={s.key}>
                    {ts(s.key)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="reason" label={t("reason")} optional={!def?.reasonRequired} help={t("reasonHelp")} error={state.fieldErrors?.reason}>
              <Textarea id="reason" name="reason" rows={2} required={def?.reasonRequired} />
            </Field>
            <Field id="status-locationId" label={t("moveTo")} optional>
              <NativeSelect id="status-locationId" name="locationId" defaultValue="__keep__">
                <option value="__keep__">—</option>
                <option value="__none__">{t("noLocation")}</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {"  ".repeat(l.depth)}
                    {l.name}
                  </option>
                ))}
              </NativeSelect>
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

/** "Move" button + dialog. */
export function MoveDialog({ itemId, current, isKit, locations }: { itemId: string; current: string | null; isKit: boolean; locations: LocationOption[] }) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(moveItem, {});

  const [open, setOpen] = useActionDialog(state);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("move")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("moveTo")}</DialogTitle>
            {isKit && <DialogDescription>{t("cascadeNote")}</DialogDescription>}
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={itemId} />
            <FormError message={state.error} />
            <Field id="move-locationId" label={t("location")} error={state.fieldErrors?.locationId}>
              <NativeSelect id="move-locationId" name="locationId" defaultValue={current ?? "__none__"}>
                <option value="__none__">{t("noLocation")}</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {"  ".repeat(l.depth)}
                    {l.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <SubmitButton pendingText={tc("loading")}>{t("move")}</SubmitButton>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
