"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError, FormSuccess } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import type { FormState } from "@/lib/forms";
import { pinDocument, removeDocument, removeDocumentVersion } from "../actions";

type Option = { id: string; label: string };

/** Pin a document to a schedule entry or a task. */
export function PinDocumentForm({ projectId, documentId, scheduleEntryId, taskId, entries, tasks }: { projectId: string; documentId: string; scheduleEntryId: string | null; taskId: string | null; entries: Option[]; tasks: Option[] }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(pinDocument, {});
  const current = scheduleEntryId ? `entry:${scheduleEntryId}` : taskId ? `task:${taskId}` : "";
  return (
    <ActionForm action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="documentId" value={documentId} />
      <Field id="pin-target" label={t("pinTo")} error={state.fieldErrors?.target} className="min-w-64 flex-1">
        <NativeSelect id="pin-target" name="target" defaultValue={state.values?.target ?? current}>
          <option value="">{t("notPinned")}</option>
          {entries.length > 0 && (
            <optgroup label={t("schedule")}>
              {entries.map((e) => (
                <option key={e.id} value={`entry:${e.id}`}>
                  {e.label}
                </option>
              ))}
            </optgroup>
          )}
          {tasks.length > 0 && (
            <optgroup label={t("tasks")}>
              {tasks.map((x) => (
                <option key={x.id} value={`task:${x.id}`}>
                  {x.label}
                </option>
              ))}
            </optgroup>
          )}
        </NativeSelect>
      </Field>
      <SubmitButton size="sm" variant="outline" pendingText={tc("loading")}>
        {tc("save")}
      </SubmitButton>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? tc("saved") : undefined} />
    </ActionForm>
  );
}

export function RemoveDocumentButton({ projectId, documentId }: { projectId: string; documentId: string }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  return (
    <form action={removeDocument}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="documentId" value={documentId} />
      <ConfirmButton confirm={t("deleteDocumentConfirm")} variant="ghost" size="sm" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}

export function RemoveVersionButton({ projectId, documentId, versionId }: { projectId: string; documentId: string; versionId: string }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  return (
    <form action={removeDocumentVersion}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="versionId" value={versionId} />
      <ConfirmButton confirm={t("deleteVersionConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
