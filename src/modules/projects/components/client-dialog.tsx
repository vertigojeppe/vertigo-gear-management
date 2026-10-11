"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/form/action-form";
import { useTranslations } from "next-intl";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { deleteClient, saveClient } from "../actions";

type ClientRow = { id: string; name: string; contactName: string | null; email: string | null; phone: string | null; address: string | null; notes: string | null };

export function ClientDialog({ client, trigger }: { client?: ClientRow; trigger: "new" | "edit" }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveClient, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | null | undefined) => (state.values && name in state.values ? state.values[name] : (fallback ?? ""));
  return (
    <>
      <Button variant={trigger === "new" ? "default" : "ghost"} size={trigger === "new" ? "default" : "xs"} onClick={() => setOpen(true)}>
        {trigger === "new" ? t("newClient") : tc("edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{client ? t("editClient") : t("newClient")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            {client && <input type="hidden" name="id" value={client.id} />}
            <FormError message={state.error} />
            <Field id="client-name" label={t("clientName")} error={err.name}>
              <Input id="client-name" name="name" defaultValue={v("name", client?.name)} required autoFocus />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="client-contact" label={t("contactName")} optional error={err.contactName}>
                <Input id="client-contact" name="contactName" defaultValue={v("contactName", client?.contactName)} />
              </Field>
              <Field id="client-phone" label={t("phone")} optional error={err.phone}>
                <Input id="client-phone" name="phone" type="tel" defaultValue={v("phone", client?.phone)} />
              </Field>
              <Field id="client-email" label={t("email")} optional error={err.email}>
                <Input id="client-email" name="email" type="email" defaultValue={v("email", client?.email)} />
              </Field>
              <Field id="client-address" label={t("address")} optional error={err.address}>
                <Input id="client-address" name="address" defaultValue={v("address", client?.address)} />
              </Field>
            </div>
            <Field id="client-notes" label={t("notes")} optional error={err.notes}>
              <Textarea id="client-notes" name="notes" rows={2} defaultValue={v("notes", client?.notes)} />
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

export function DeleteClientButton({ id }: { id: string }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  return (
    <form action={deleteClient}>
      <input type="hidden" name="id" value={id} />
      <ConfirmButton confirm={t("deleteClientConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
