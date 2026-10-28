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
import { CUSTOM_FIELD_ENTITIES, CUSTOM_FIELD_TYPES } from "@/lib/custom-fields";
import type { FormState } from "@/lib/forms";
import { createCustomField, deleteCustomField, updateCustomField } from "@/modules/settings/actions";

type FieldRow = { id: string; entity: string; categoryId: string | null; key: string; label: string; type: string; options: string[]; required: boolean; showInList: boolean; sortOrder: number };
type CategoryOption = { id: string; name: string; depth: number };

export function CustomFieldDialog({ field, trigger, categories }: { field?: FieldRow; trigger: "new" | "edit"; categories: CategoryOption[] }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(field ? updateCustomField : createCustomField, {});
  const [type, setType] = useState(field?.type ?? "text");
  const [entity, setEntity] = useState(field?.entity ?? "item");
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | number | null | undefined) =>
    state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback);

  return (
    <>
      <Button variant={trigger === "new" ? "default" : "ghost"} size={trigger === "new" ? "default" : "xs"} onClick={() => setOpen(true)}>
        {trigger === "new" ? t("addField") : tc("edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{field ? t("editField") : t("addField")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            {field && <input type="hidden" name="id" value={field.id} />}
            <FormError message={state.error} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="cf-entity" label={t("cfEntity")} error={err.entity}>
                <NativeSelect id="cf-entity" name="entity" value={entity} onChange={(e) => setEntity(e.target.value)} disabled={Boolean(field)}>
                  {CUSTOM_FIELD_ENTITIES.map((e) => (
                    <option key={e} value={e}>
                      {t(`entity.${e}`)}
                    </option>
                  ))}
                </NativeSelect>
                {field && <input type="hidden" name="entity" value={field.entity} />}
              </Field>
              <Field id="cf-type" label={t("cfType")} error={err.type}>
                <NativeSelect id="cf-type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
                  {CUSTOM_FIELD_TYPES.map((ty) => (
                    <option key={ty} value={ty}>
                      {t(`fieldType.${ty}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="cf-label" label={t("cfLabel")} error={err.label}>
                <Input id="cf-label" name="label" defaultValue={v("label", field?.label)} required autoFocus />
              </Field>
              <Field id="cf-key" label={t("cfKey")} help={t("cfKeyHelp")} error={err.key}>
                <Input id="cf-key" name="key" defaultValue={v("key", field?.key)} required pattern="[a-z][a-z0-9_]*" disabled={Boolean(field)} />
                {field && <input type="hidden" name="key" value={field.key} />}
              </Field>
            </div>
            {(entity === "model" || entity === "item") && (
              <Field id="cf-category" label={t("cfCategory")} help={t("cfCategoryHelp")} error={err.categoryId}>
                <NativeSelect id="cf-category" name="categoryId" defaultValue={v("categoryId", field?.categoryId)}>
                  <option value="">{t("allCategories")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {"  ".repeat(c.depth)}
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {type === "select" && (
              <Field id="cf-options" label={t("cfOptions")} help={t("cfOptionsHelp")} error={err.optionsText}>
                <Textarea id="cf-options" name="optionsText" rows={4} defaultValue={v("optionsText", field?.options.join("\n"))} />
              </Field>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="required" className="size-4" defaultChecked={state.values ? state.values.required === "on" : field?.required} />
                {t("cfRequired")}
              </label>
              {entity === "model" && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="showInList" className="size-4" defaultChecked={state.values ? state.values.showInList === "on" : field?.showInList} />
                  {t("cfShowInList")}
                </label>
              )}
              <Field id="cf-order" label={t("cfOrder")} optional error={err.sortOrder}>
                <Input id="cf-order" name="sortOrder" type="number" step="1" defaultValue={v("sortOrder", field?.sortOrder ?? 0)} />
              </Field>
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

export function DeleteCustomFieldButton({ id }: { id: string }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  return (
    <form action={deleteCustomField}>
      <input type="hidden" name="id" value={id} />
      <ConfirmButton confirm={t("deleteFieldConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
