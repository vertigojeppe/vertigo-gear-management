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
import { deleteContact, saveContact } from "../actions";
import { CONTACT_KINDS } from "../schema";

export type ContactRow = { id: string; kind: string; name: string; organisation: string | null; email: string | null; phone: string | null; address: string | null; notes: string | null };

export function ContactDialog({ contact, trigger }: { contact?: ContactRow; trigger: "new" | "edit" }) {
  const t = useTranslations("contacts");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveContact, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | null | undefined) => (state.values && name in state.values ? state.values[name] : (fallback ?? ""));
  return (
    <>
      <Button variant={trigger === "new" ? "default" : "ghost"} size={trigger === "new" ? "default" : "xs"} onClick={() => setOpen(true)}>
        {trigger === "new" ? t("newContact") : tc("edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{contact ? t("editContact") : t("newContact")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            {contact && <input type="hidden" name="id" value={contact.id} />}
            <FormError message={state.error} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="ct-kind" label={t("kind")} error={err.kind}>
                <NativeSelect id="ct-kind" name="kind" defaultValue={v("kind", contact?.kind ?? "person")}>
                  {CONTACT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(k)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="ct-name" label={t("name")} error={err.name}>
                <Input id="ct-name" name="name" defaultValue={v("name", contact?.name)} required autoFocus />
              </Field>
              <Field id="ct-org" label={t("organisation")} optional error={err.organisation}>
                <Input id="ct-org" name="organisation" defaultValue={v("organisation", contact?.organisation)} />
              </Field>
              <Field id="ct-phone" label={t("phone")} optional error={err.phone}>
                <Input id="ct-phone" name="phone" type="tel" defaultValue={v("phone", contact?.phone)} />
              </Field>
              <Field id="ct-email" label={t("email")} optional error={err.email} className="sm:col-span-2">
                <Input id="ct-email" name="email" type="email" defaultValue={v("email", contact?.email)} />
              </Field>
              <Field id="ct-address" label={t("address")} optional error={err.address} className="sm:col-span-2">
                <Input id="ct-address" name="address" defaultValue={v("address", contact?.address)} />
              </Field>
            </div>
            <Field id="ct-notes" label={t("notes")} optional error={err.notes}>
              <Textarea id="ct-notes" name="notes" rows={3} defaultValue={v("notes", contact?.notes)} />
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

export function DeleteContactButton({ id, back = false }: { id: string; back?: boolean }) {
  const t = useTranslations("contacts");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(deleteContact, {});
  return (
    <ActionForm action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {back && <input type="hidden" name="back" value="1" />}
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
      <ConfirmButton confirm={t("deleteConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </ActionForm>
  );
}
