"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { StatusPill } from "@/components/status-pill";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/forms";
import { applySpecs, previewSpecs, type SpecPreviewData } from "../actions";
import { pickable, pickKey, type SpecChange } from "../specs";
import { SpecChangeTable } from "./spec-changes";
import type { SpecImportResult } from "../specs-service";

/**
 * Settings › Import › Specs: upload the sheet, read the preview, tick what
 * to write (empty fields start ticked, values the model already has start
 * unticked), confirm. The plan is rebuilt on confirm.
 */
export function SpecImport() {
  const t = useTranslations("specImport");
  const [preview, previewAction] = useActionState<FormState<SpecPreviewData>, FormData>(previewSpecs, {});
  const [applied, applyAction] = useActionState<FormState<SpecImportResult>, FormData>(applySpecs, {});
  const data = preview.data;
  const done = applied.ok ? applied.data : undefined;

  return (
    <div className="flex flex-col gap-6">
      <form action={previewAction} className="flex max-w-xl flex-col gap-4">
        <FormError message={preview.error} />
        <Field id="spec-file" label={t("file")} help={t("fileHelp")} error={preview.fieldErrors?.file}>
          <Input id="spec-file" name="file" type="file" accept=".csv,text/csv" required />
        </Field>
        <div>
          <SubmitButton pendingText={t("reading")}>{t("preview")}</SubmitButton>
        </div>
      </form>

      {done ? (
        <p role="status" className="rounded-md border border-green-600/40 bg-green-50 p-3 text-sm dark:bg-green-950/30">
          {t("done", { fields: done.fields, models: done.models, checked: done.checked })}{" "}
          <button type="button" className="underline" onClick={() => window.location.reload()}>
            {t("another")}
          </button>
        </p>
      ) : (
        data && <SpecPreview key={`${data.fileName}:${data.text.length}`} data={data} action={applyAction} error={applied.error} />
      )}
    </div>
  );
}

function SpecPreview({ data, action, error }: { data: SpecPreviewData; action: (fd: FormData) => void; error?: string }) {
  const t = useTranslations("specImport");
  const { plan } = data;
  const [picked, setPicked] = useState<Set<string>>(() => new Set(plan.models.flatMap((m) => m.changes.filter((c) => c.action === "fill").map((c) => pickKey(m.id, c.field)))));
  const [showAll, setShowAll] = useState(false);
  const toggle = (key: string, on: boolean) =>
    setPicked((p) => {
      const next = new Set(p);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const count = (action: SpecChange["action"]) => plan.models.reduce((n, m) => n + m.changes.filter((c) => c.action === action).length, 0);
  const pickedModels = plan.models.filter((m) => m.changes.some((c) => picked.has(pickKey(m.id, c.field)))).length;
  const shown = plan.models.filter((m) => showAll || m.changes.some((c) => pickable(c.action)));

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="sheet" value={data.text} />
      <input type="hidden" name="fileName" value={data.fileName} />
      <FormError message={error} />
      {plan.errors.length > 0 && (
        <div role="alert" className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">
          <p className="font-medium">{t("errors")}</p>
          <ul className="mt-1 list-disc pl-5">
            {plan.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
        <span className="font-medium">{data.fileName}</span>
        <StatusPill color="green">{t("summaryFill", { count: count("fill") })}</StatusPill>
        {count("keep") > 0 && <StatusPill color="amber">{t("summaryKeep", { count: count("keep") })}</StatusPill>}
        {count("unavailable") > 0 && <StatusPill color="red">{t("summaryUnavailable", { count: count("unavailable") })}</StatusPill>}
        {plan.unknownIds.length > 0 && <StatusPill color="red">{t("summaryUnknown", { count: plan.unknownIds.length })}</StatusPill>}
        <span className="ml-auto">
          {plan.models.length > 0 && plan.errors.length === 0 && (
            <SubmitButton pendingText={t("applying")}>{picked.size > 0 ? t("apply", { fields: picked.size, models: pickedModels }) : t("applyNone")}</SubmitButton>
          )}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{t("explain")}</p>
      {count("unavailable") > 0 && <p className="text-sm text-destructive">{t("unavailableHelp")}</p>}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        {t("showAll")}
      </label>
      <ul className="divide-y rounded-md border text-sm">
        {shown.map((m) => (
          <li key={m.id} className="flex flex-col gap-1 px-3 py-2">
            <Link href={`/inventory/models/${m.id}`} className="font-medium hover:underline">
              {m.label}
            </Link>
            <SpecChangeTable modelId={m.id} modelLabel={m.label} changes={m.changes} picked={picked} onToggle={toggle} />
          </li>
        ))}
      </ul>
      {plan.unknownIds.length > 0 && <p className="text-sm text-muted-foreground">{t("unknown", { lines: plan.unknownIds.map((u) => u.line).join(", ") })}</p>}
    </ActionForm>
  );
}
