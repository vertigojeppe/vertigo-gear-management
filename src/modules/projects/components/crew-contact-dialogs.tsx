"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/form/action-form";
import { useTranslations } from "next-intl";
import { Field, FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/forms";
import { addContact, addCrew, removeContact, removeCrew } from "../actions";

type UserOption = { id: string; name: string };

export function CrewDialog({ projectId, users }: { projectId: string; users: UserOption[] }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(addCrew, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("addCrew")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addCrew")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="projectId" value={projectId} />
            <FormError message={state.error} />
            <Field id="crew-user" label={t("person")} error={err.userId}>
              <NativeSelect id="crew-user" name="userId" defaultValue={state.values?.userId ?? ""} required>
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="crew-role" label={t("role")} optional error={err.role}>
                <Input id="crew-role" name="role" defaultValue={state.values?.role ?? ""} placeholder="Lighting op" />
              </Field>
              <Field id="crew-call" label={t("callTime")} optional error={err.callTime}>
                <Input id="crew-call" name="callTime" type="datetime-local" defaultValue={state.values?.callTime ?? ""} />
              </Field>
            </div>
            <Field id="crew-notes" label={t("notes")} optional error={err.notes}>
              <Input id="crew-notes" name="notes" defaultValue={state.values?.notes ?? ""} />
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

export type ContactOption = { id: string; name: string; kind: string; organisation: string | null };

/**
 * Adds a contact to the project: someone from the contact library, or a new
 * person who goes into the library on the way. Role and notes are this job's.
 */
export function ContactDialog({ projectId, contacts, canCreate }: { projectId: string; contacts: ContactOption[]; canCreate: boolean }) {
  const t = useTranslations("projects");
  const tk = useTranslations("contacts");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(addContact, {});
  const [open, setOpen] = useActionDialog(state);
  const [pick, setPick] = useState("");
  const err = state.fieldErrors ?? {};
  const isNew = pick === "";
  const label = (c: ContactOption) => (c.organisation ? `${c.name} (${c.organisation})` : c.name);
  const people = contacts.filter((c) => c.kind !== "company");
  const companies = contacts.filter((c) => c.kind === "company");
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setPick("");
          setOpen(true);
        }}
      >
        {t("addContact")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addContact")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="projectId" value={projectId} />
            <FormError message={state.error} />
            <Field id="ct-contact" label={t("fromLibrary")} error={err.contactId}>
              <NativeSelect id="ct-contact" name="contactId" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">{canCreate ? t("newContactOption") : t("chooseContact")}</option>
                {people.length > 0 && (
                  <optgroup label={tk("personPlural")}>
                    {people.map((c) => (
                      <option key={c.id} value={c.id}>
                        {label(c)}
                      </option>
                    ))}
                  </optgroup>
                )}
                {companies.length > 0 && (
                  <optgroup label={tk("companyPlural")}>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {label(c)}
                      </option>
                    ))}
                  </optgroup>
                )}
              </NativeSelect>
            </Field>
            {isNew && canCreate && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="ct-name" label={tc("name")} error={err.name}>
                  <Input id="ct-name" name="name" defaultValue={state.values?.name ?? ""} autoFocus />
                </Field>
                <Field id="ct-org" label={tk("organisation")} optional error={err.organisation}>
                  <Input id="ct-org" name="organisation" defaultValue={state.values?.organisation ?? ""} />
                </Field>
                <Field id="ct-phone" label={t("phone")} optional error={err.phone}>
                  <Input id="ct-phone" name="phone" type="tel" defaultValue={state.values?.phone ?? ""} />
                </Field>
                <Field id="ct-email" label={t("email")} optional error={err.email}>
                  <Input id="ct-email" name="email" type="email" defaultValue={state.values?.email ?? ""} />
                </Field>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="ct-role" label={t("role")} optional error={err.role}>
                <Input id="ct-role" name="role" defaultValue={state.values?.role ?? ""} placeholder="Venue tech" />
              </Field>
              <Field id="ct-notes" label={t("notes")} optional error={err.notes}>
                <Input id="ct-notes" name="notes" defaultValue={state.values?.notes ?? ""} />
              </Field>
            </div>
            {isNew && canCreate && <p className="text-xs text-muted-foreground">{t("newContactHint")}</p>}
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

export function RemoveCrewButton({ id, projectId }: { id: string; projectId: string }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  return (
    <form action={removeCrew}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="projectId" value={projectId} />
      <ConfirmButton confirm={t("removeConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}

export function RemoveContactButton({ id, projectId }: { id: string; projectId: string }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  return (
    <form action={removeContact}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="projectId" value={projectId} />
      <ConfirmButton confirm={t("removeConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
