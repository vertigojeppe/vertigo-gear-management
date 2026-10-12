"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/form/action-form";
import { useTranslations } from "next-intl";
import { Field, FormError } from "@/components/form/field";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { LOCATION_TYPES } from "../../../../config/app.config";
import { deleteCategory, deleteLocation, saveCategory, saveLocation } from "../actions";

type Option = { id: string; name: string; depth: number };
type Person = { id: string; name: string };
export type PeopleOptions = { users: Person[]; contacts: Person[] };

/* Category ----------------------------------------------------------------- */

export function CategoryDialog({
  category,
  parents,
  trigger,
}: {
  category?: { id: string; name: string; parentId: string | null; sortOrder: number };
  parents: Option[];
  trigger: "new" | "edit";
}) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveCategory, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  return (
    <>
      <Button variant={trigger === "new" ? "default" : "ghost"} size={trigger === "new" ? "default" : "xs"} onClick={() => setOpen(true)}>
        {trigger === "new" ? t("newCategory") : tc("edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{category ? t("editCategory") : t("newCategory")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            {category && <input type="hidden" name="id" value={category.id} />}
            <FormError message={state.error} />
            <Field id="cat-name" label={tc("name")} error={err.name}>
              <Input id="cat-name" name="name" defaultValue={state.values?.name ?? category?.name ?? ""} required autoFocus />
            </Field>
            <Field id="cat-parent" label={t("parentCategory")} error={err.parentId}>
              <NativeSelect id="cat-parent" name="parentId" defaultValue={state.values?.parentId ?? category?.parentId ?? ""}>
                <option value="">{t("noParent")}</option>
                {parents
                  .filter((p) => p.id !== category?.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {"  ".repeat(p.depth)}
                      {p.name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            <Field id="cat-sort" label={t("sortOrder")} optional error={err.sortOrder}>
              <Input id="cat-sort" name="sortOrder" type="number" step="1" defaultValue={state.values?.sortOrder ?? category?.sortOrder ?? 0} />
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

export function DeleteCategoryButton({ id }: { id: string }) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(async (_p, fd) => deleteCategory(fd), {});
  return (
    <ActionForm action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
      <ConfirmButton confirm={t("deleteCategoryConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </ActionForm>
  );
}

/* Location ----------------------------------------------------------------- */

export function LocationDialog({
  location,
  parents,
  people,
  trigger,
}: {
  location?: { id: string; name: string; type: string; parentId: string | null; notes: string | null; userId?: string | null; contactId?: string | null };
  parents: Option[];
  people: PeopleOptions;
  trigger: "new" | "edit";
}) {
  const t = useTranslations("inventory");
  const tl = useTranslations("locationType");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveLocation, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const [type, setType] = useState(state.values?.type ?? location?.type ?? "warehouse");
  const personDefault = state.values?.person ?? (location?.userId ? `user:${location.userId}` : location?.contactId ? `contact:${location.contactId}` : "");
  return (
    <>
      <Button variant={trigger === "new" ? "default" : "ghost"} size={trigger === "new" ? "default" : "xs"} onClick={() => setOpen(true)}>
        {trigger === "new" ? t("newLocation") : tc("edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{location ? t("editLocation") : t("newLocation")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            {location && <input type="hidden" name="id" value={location.id} />}
            <FormError message={state.error} />
            <Field id="loc-name" label={tc("name")} error={err.name}>
              <Input id="loc-name" name="name" defaultValue={state.values?.name ?? location?.name ?? ""} required autoFocus />
            </Field>
            <Field id="loc-type" label={t("locationType")} error={err.type}>
              <NativeSelect id="loc-type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
                {LOCATION_TYPES.map((lt) => (
                  <option key={lt} value={lt}>
                    {tl(lt)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {type === "person" && (
              <Field id="loc-person" label={t("person")} help={t("personHelp")} error={err.person}>
                <NativeSelect id="loc-person" name="person" defaultValue={personDefault} required>
                  <option value="">—</option>
                  <optgroup label={t("staff")}>
                    {people.users.map((u) => (
                      <option key={u.id} value={`user:${u.id}`}>
                        {u.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t("contactsGroup")}>
                    {people.contacts.map((c) => (
                      <option key={c.id} value={`contact:${c.id}`}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                </NativeSelect>
              </Field>
            )}
            <Field id="loc-parent" label={t("parentLocation")} optional error={err.parentId}>
              <NativeSelect id="loc-parent" name="parentId" defaultValue={state.values?.parentId ?? location?.parentId ?? ""}>
                <option value="">{t("noParent")}</option>
                {parents
                  .filter((p) => p.id !== location?.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {"  ".repeat(p.depth)}
                      {p.name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            <Field id="loc-notes" label={tc("notes")} optional error={err.notes}>
              <Textarea id="loc-notes" name="notes" rows={2} defaultValue={state.values?.notes ?? location?.notes ?? ""} />
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

export function DeleteLocationButton({ id }: { id: string }) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(async (_p, fd) => deleteLocation(fd), {});
  return (
    <ActionForm action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
      <ConfirmButton confirm={t("deleteLocationConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </ActionForm>
  );
}
