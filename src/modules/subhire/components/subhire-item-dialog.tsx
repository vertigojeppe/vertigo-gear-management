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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/form/decimal-input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { deleteSubHireItem, saveSubHireItem, setSubHireItemArchived } from "../actions";
import { linksToText } from "../schema";
import type { SubHireItemRow } from "../queries";

export type OwnerOption = { id: string; name: string; organisation: string | null };
type CategoryOption = { id: string; name: string; depth: number };

export function SubHireItemDialog({ item, owners, categories, trigger }: { item?: SubHireItemRow; owners: OwnerOption[]; categories: CategoryOption[]; trigger: "new" | "edit" }) {
  const t = useTranslations("subhire");
  const ti = useTranslations("inventory");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveSubHireItem, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | number | null | undefined) =>
    state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback);
  return (
    <>
      <Button variant={trigger === "new" ? "default" : "ghost"} size={trigger === "new" ? "default" : "xs"} onClick={() => setOpen(true)}>
        {trigger === "new" ? t("newItem") : tc("edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{item ? t("editItem") : t("newItem")}</DialogTitle>
            <DialogDescription>{t("itemHelp")}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            {item && <input type="hidden" name="id" value={item.id} />}
            <FormError message={state.error} />
            <Field id="sh-owner" label={t("owner")} help={t("ownerHelp")} error={err.ownerContactId}>
              <NativeSelect id="sh-owner" name="ownerContactId" defaultValue={v("ownerContactId", item?.ownerContactId)} required>
                <option value="">—</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.organisation ? `${o.name} (${o.organisation})` : o.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="sh-manufacturer" label={ti("manufacturer")} optional error={err.manufacturer}>
                <Input id="sh-manufacturer" name="manufacturer" defaultValue={v("manufacturer", item?.manufacturer)} />
              </Field>
              <Field id="sh-name" label={t("name")} error={err.name}>
                <Input id="sh-name" name="name" defaultValue={v("name", item?.name)} required />
              </Field>
              <Field id="sh-variant" label={ti("variant")} optional error={err.variant}>
                <Input id="sh-variant" name="variant" defaultValue={v("variant", item?.variant)} />
              </Field>
              <Field id="sh-category" label={ti("category")} optional error={err.categoryId}>
                <NativeSelect id="sh-category" name="categoryId" defaultValue={v("categoryId", item?.categoryId)}>
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {"  ".repeat(c.depth)}
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="sh-cost" label={t("costPerDay")} help={t("costPerDayHelp")} optional error={err.costPerDay}>
                <DecimalInput id="sh-cost" name="costPerDay" defaultValue={v("costPerDay", item?.costPerDay)} />
              </Field>
              <Field id="sh-price" label={t("rentalDayPrice")} help={t("rentalDayPriceHelp")} optional error={err.rentalDayPrice}>
                <DecimalInput id="sh-price" name="rentalDayPrice" defaultValue={v("rentalDayPrice", item?.rentalDayPrice)} />
              </Field>
            </div>
            <Field id="sh-description" label={t("description")} help={t("descriptionHelp")} optional error={err.description}>
              <Textarea id="sh-description" name="description" rows={2} defaultValue={v("description", item?.description)} />
            </Field>
            <Field id="sh-links" label={t("links")} help={t("linksHelp")} optional error={err.linksText}>
              <Textarea id="sh-links" name="linksText" rows={2} defaultValue={v("linksText", item ? linksToText(item.links) : "")} />
            </Field>
            <Field id="sh-notes" label={t("notes")} optional error={err.notes}>
              <Textarea id="sh-notes" name="notes" rows={2} defaultValue={v("notes", item?.notes)} />
            </Field>
            {item && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="archived" className="size-4" defaultChecked={state.values ? state.values.archived === "on" : item.archived} />
                {t("archived")}
              </label>
            )}
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

export function ArchiveSubHireItemButton({ id, archived }: { id: string; archived: boolean }) {
  const t = useTranslations("subhire");
  return (
    <form action={setSubHireItemArchived}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="archived" value={archived ? "false" : "true"} />
      <Button type="submit" variant="ghost" size="xs">
        {archived ? t("unarchive") : t("archive")}
      </Button>
    </form>
  );
}

export function DeleteSubHireItemButton({ id }: { id: string }) {
  const t = useTranslations("subhire");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(deleteSubHireItem, {});
  return (
    <ActionForm action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
      <ConfirmButton confirm={t("deleteConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </ActionForm>
  );
}
