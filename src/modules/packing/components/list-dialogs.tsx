"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError, FormSuccess } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { PACKING_GROUPINGS } from "../../../../config/app.config";
import { addKitLine, addLine, applyTemplateToList, removeLine, saveListAsTemplate, updateLine, updatePackingList } from "../actions";

type ModelOption = { id: string; manufacturer: string; name: string; trackingType: string };
type Option = { id: string; label: string };
type Ids = { projectId: string; listId: string };

function DialogShell({ title, description, open, setOpen, children }: { title: string; description?: string; open: boolean; setOpen: (o: boolean) => void; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function AddGearDialog({ ids, models, cases }: { ids: Ids; models: ModelOption[]; cases: Option[] }) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(addLine, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {t("addGear")}
      </Button>
      <DialogShell title={t("addGear")} open={open} setOpen={setOpen}>
        <ActionForm action={action} className="flex flex-col gap-4">
          <input type="hidden" name="projectId" value={ids.projectId} />
          <input type="hidden" name="listId" value={ids.listId} />
          <FormError message={state.error} />
          <Field id="pl-model" label={t("model")} error={err.modelId}>
            <NativeSelect id="pl-model" name="modelId" defaultValue={state.values?.modelId ?? ""} required>
              <option value="">—</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.manufacturer} {m.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="pl-qty" label={t("quantity")} error={err.quantity}>
              <Input id="pl-qty" name="quantity" type="number" min="1" step="1" defaultValue={state.values?.quantity ?? "1"} required />
            </Field>
            <Field id="pl-case" label={t("case")} optional error={err.caseItemId}>
              <NativeSelect id="pl-case" name="caseItemId" defaultValue={state.values?.caseItemId ?? ""}>
                <option value="">{t("noCase")}</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field id="pl-note" label={t("note")} optional error={err.note}>
            <Input id="pl-note" name="note" defaultValue={state.values?.note ?? ""} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pendingText={tc("loading")}>{tc("add")}</SubmitButton>
          </div>
        </ActionForm>
      </DialogShell>
    </>
  );
}

export function AddKitDialog({ ids, kits }: { ids: Ids; kits: Option[] }) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(addKitLine, {});
  const [open, setOpen] = useActionDialog(state);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {t("addKit")}
      </Button>
      <DialogShell title={t("addKit")} open={open} setOpen={setOpen}>
        <ActionForm action={action} className="flex flex-col gap-4">
          <input type="hidden" name="projectId" value={ids.projectId} />
          <input type="hidden" name="listId" value={ids.listId} />
          <FormError message={state.error} />
          <Field id="pl-kit" label={t("kit")} error={state.fieldErrors?.kitItemId}>
            <NativeSelect id="pl-kit" name="kitItemId" defaultValue="" required>
              <option value="">—</option>
              {kits.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pendingText={tc("loading")}>{tc("add")}</SubmitButton>
          </div>
        </ActionForm>
      </DialogShell>
    </>
  );
}

export function ApplyTemplateDialog({ ids, templates }: { ids: Ids; templates: Option[] }) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(applyTemplateToList, {});
  const [open, setOpen] = useActionDialog(state);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {t("applyTemplate")}
      </Button>
      <DialogShell title={t("applyTemplate")} open={open} setOpen={setOpen}>
        <ActionForm action={action} className="flex flex-col gap-4">
          <input type="hidden" name="projectId" value={ids.projectId} />
          <input type="hidden" name="listId" value={ids.listId} />
          <FormError message={state.error} />
          <Field id="pl-template" label={t("template")} error={state.fieldErrors?.templateId}>
            <NativeSelect id="pl-template" name="templateId" defaultValue="" required>
              <option value="">—</option>
              {templates.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pendingText={tc("loading")}>{tc("add")}</SubmitButton>
          </div>
        </ActionForm>
      </DialogShell>
    </>
  );
}

export function EditLineDialog({
  ids,
  line,
  cases,
  units,
}: {
  ids: Ids;
  line: { id: string; quantity: number; note: string | null; caseItemId: string | null; itemId: string | null; isKit: boolean; trackingType: string };
  cases: Option[];
  units: { id: string; assetTag: string; serialNumber: string | null }[];
}) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(updateLine, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  return (
    <>
      <Button size="xs" variant="ghost" onClick={() => setOpen(true)}>
        {tc("edit")}
      </Button>
      <DialogShell title={t("editLine")} open={open} setOpen={setOpen}>
        <ActionForm action={action} className="flex flex-col gap-4">
          <input type="hidden" name="projectId" value={ids.projectId} />
          <input type="hidden" name="listId" value={ids.listId} />
          <input type="hidden" name="lineId" value={line.id} />
          <FormError message={state.error} />
          <div className="grid grid-cols-2 gap-3">
            <Field id="el-qty" label={t("quantity")} error={err.quantity}>
              <Input id="el-qty" name="quantity" type="number" min="1" step="1" defaultValue={state.values?.quantity ?? String(line.quantity)} disabled={line.isKit} />
            </Field>
            <Field id="el-case" label={t("case")} optional error={err.caseItemId}>
              <NativeSelect id="el-case" name="caseItemId" defaultValue={state.values?.caseItemId ?? line.caseItemId ?? ""}>
                <option value="">{t("noCase")}</option>
                {cases
                  .filter((c) => c.id !== line.itemId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
          </div>
          {line.trackingType === "serialized" && !line.isKit && (
            <Field id="el-unit" label={t("unit")} optional error={err.itemId}>
              <NativeSelect id="el-unit" name="itemId" defaultValue={state.values?.itemId ?? line.itemId ?? ""}>
                <option value="">{t("anyUnit")}</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.assetTag}
                    {u.serialNumber ? ` · SN ${u.serialNumber}` : ""}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field id="el-note" label={t("note")} optional error={err.note}>
            <Input id="el-note" name="note" defaultValue={state.values?.note ?? line.note ?? ""} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pendingText={tc("loading")}>{tc("save")}</SubmitButton>
          </div>
        </ActionForm>
      </DialogShell>
    </>
  );
}

export function RemoveLineButton({ ids, lineId }: { ids: Ids; lineId: string }) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  return (
    <form action={removeLine}>
      <input type="hidden" name="projectId" value={ids.projectId} />
      <input type="hidden" name="listId" value={ids.listId} />
      <input type="hidden" name="lineId" value={lineId} />
      <ConfirmButton confirm={t("removeConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}

export function EditListDialog({ ids, list }: { ids: Ids; list: { name: string; groupBy: string; notes: string | null } }) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(updatePackingList, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {tc("edit")}
      </Button>
      <DialogShell title={t("editList")} open={open} setOpen={setOpen}>
        <ActionForm action={action} className="flex flex-col gap-4">
          <input type="hidden" name="projectId" value={ids.projectId} />
          <input type="hidden" name="listId" value={ids.listId} />
          <FormError message={state.error} />
          <Field id="ls-name" label={t("name")} error={err.name}>
            <Input id="ls-name" name="name" defaultValue={state.values?.name ?? list.name} required />
          </Field>
          <Field id="ls-group" label={t("groupBy")} error={err.groupBy}>
            <NativeSelect id="ls-group" name="groupBy" defaultValue={state.values?.groupBy ?? list.groupBy}>
              {PACKING_GROUPINGS.map((g) => (
                <option key={g} value={g}>
                  {t(g === "category" ? "groupCategory" : "groupCase")}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="ls-notes" label={t("notes")} optional error={err.notes}>
            <Textarea id="ls-notes" name="notes" rows={3} defaultValue={state.values?.notes ?? list.notes ?? ""} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pendingText={tc("loading")}>{tc("save")}</SubmitButton>
          </div>
        </ActionForm>
      </DialogShell>
    </>
  );
}

export function SaveAsTemplateDialog({ listId, defaultName }: { listId: string; defaultName: string }) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveListAsTemplate, {});
  const [open, setOpen] = useActionDialog(state);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {t("saveAsTemplate")}
      </Button>
      <DialogShell title={t("saveAsTemplate")} open={open} setOpen={setOpen}>
        <ActionForm action={action} className="flex flex-col gap-4">
          <input type="hidden" name="listId" value={listId} />
          <FormError message={state.error} />
          <FormSuccess message={state.ok ? tc("saved") : undefined} />
          <Field id="tpl-name" label={t("templateName")} error={state.fieldErrors?.name}>
            <Input id="tpl-name" name="name" defaultValue={defaultName} required autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pendingText={tc("loading")}>{tc("save")}</SubmitButton>
          </div>
        </ActionForm>
      </DialogShell>
    </>
  );
}
