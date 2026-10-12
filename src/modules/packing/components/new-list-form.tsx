"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { PACKING_GROUPINGS } from "../../../../config/app.config";
import { createPackingList } from "../actions";
import { LIST_SOURCES } from "../schema";

type Option = { id: string; label: string };

export function NewListForm({ projectId, defaultName, templates, otherLists, hasReservations }: { projectId: string; defaultName: string; templates: Option[]; otherLists: Option[]; hasReservations: boolean }) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(createPackingList, {});
  const [source, setSource] = useState(state.values?.source ?? (hasReservations ? "reservations" : "empty"));
  const err = state.fieldErrors ?? {};
  const sourceLabel: Record<string, string> = { empty: t("sourceEmpty"), reservations: t("sourceReservations"), template: t("sourceTemplate"), copy: t("sourceCopy") };

  return (
    <ActionForm action={action} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="projectId" value={projectId} />
      <FormError message={state.error} />
      <Field id="nl-name" label={t("name")} error={err.name}>
        <Input id="nl-name" name="name" defaultValue={state.values?.name ?? defaultName} required autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="nl-group" label={t("groupBy")} error={err.groupBy}>
          <NativeSelect id="nl-group" name="groupBy" defaultValue={state.values?.groupBy ?? "category"}>
            {PACKING_GROUPINGS.map((g) => (
              <option key={g} value={g}>
                {t(g === "category" ? "groupCategory" : "groupCase")}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="nl-source" label={t("source")} error={err.source}>
          <NativeSelect id="nl-source" name="source" value={source} onChange={(e) => setSource(e.target.value)}>
            {LIST_SOURCES.filter((s) => (s === "template" ? templates.length > 0 : s === "copy" ? otherLists.length > 0 : s === "reservations" ? hasReservations : true)).map((s) => (
              <option key={s} value={s}>
                {sourceLabel[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {source === "template" && (
        <Field id="nl-template" label={t("template")} error={err.sourceId}>
          <NativeSelect id="nl-template" name="sourceId" defaultValue={state.values?.sourceId ?? templates[0]?.id ?? ""} required>
            {templates.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      {source === "copy" && (
        <Field id="nl-copy" label={t("copyFrom")} error={err.sourceId}>
          <NativeSelect id="nl-copy" name="sourceId" defaultValue={state.values?.sourceId ?? otherLists[0]?.id ?? ""} required>
            {otherLists.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <Field id="nl-notes" label={t("notes")} optional error={err.notes}>
        <Textarea id="nl-notes" name="notes" rows={3} defaultValue={state.values?.notes ?? ""} />
      </Field>
      <div className="flex gap-2">
        <SubmitButton pendingText={tc("loading")}>{tc("create")}</SubmitButton>
        <Link href={`/projects/${projectId}`} className={buttonVariants({ variant: "outline" })}>
          {tc("cancel")}
        </Link>
      </div>
    </ActionForm>
  );
}
