"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/forms";
import { editFamily } from "../actions";

/** What the variants share; null where they differ. */
export type FamilyState = { count: number; manufacturer: string | null; categoryId: string | null; notForRental: boolean | null; archived: boolean | null; consumable: boolean | null };

/**
 * Admin: edit a whole family in one go. Manufacturer and name, category and
 * the flags apply to every variant; a field the variants disagree on starts
 * at "mixed – leave as is". Sizes, stock, weight and prices stay per variant.
 */
export function EditFamilyDialog({ modelId, name, family, categories }: { modelId: string; name: string; family: FamilyState; categories: { id: string; name: string; depth: number }[] }) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(editFamily, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (field: string, fallback: string) => (state.values && field in state.values ? state.values[field] : fallback);
  const flag = (field: "notForRental" | "archived" | "consumable", label: string) => {
    const current = family[field];
    return (
      <Field id={`ef-${field}`} label={label} error={err[field]}>
        <NativeSelect id={`ef-${field}`} name={field} defaultValue={v(field, current === null ? "" : current ? "yes" : "no")}>
          {current === null && <option value="">{t("familyMixed")}</option>}
          <option value="yes">{tc("yes")}</option>
          <option value="no">{tc("no")}</option>
        </NativeSelect>
      </Field>
    );
  };
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("editFamily")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("editFamily")}</DialogTitle>
            <DialogDescription>{t("editFamilyHelp", { count: family.count })}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="modelId" value={modelId} />
            <FormError message={state.error} />
            <Field id="ef-name" label={t("modelName")} help={t("modelNameHelp")} error={err.name}>
              <Input id="ef-name" name="name" defaultValue={v("name", name)} required autoFocus />
            </Field>
            <Field id="ef-manufacturer" label={t("manufacturer")} optional help={family.manufacturer === null ? t("familyMakersMixed") : undefined} error={err.manufacturer}>
              <Input id="ef-manufacturer" name="manufacturer" defaultValue={v("manufacturer", family.manufacturer ?? "")} placeholder={family.manufacturer === null ? t("familyMixed") : undefined} />
            </Field>
            {family.manufacturer === null && <input type="hidden" name="manufacturerMixed" value="1" />}
            <Field id="ef-category" label={t("category")} error={err.categoryId}>
              <NativeSelect id="ef-category" name="categoryId" defaultValue={v("categoryId", family.categoryId ?? "")}>
                {family.categoryId === null && <option value="">{t("familyMixed")}</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {"  ".repeat(c.depth)}
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              {flag("notForRental", t("notForRental"))}
              {flag("consumable", t("consumable"))}
              {flag("archived", t("archived"))}
            </div>
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
