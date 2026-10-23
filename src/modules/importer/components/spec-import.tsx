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
import type { ChangeAction } from "../specs";
import type { SpecImportResult } from "../specs-service";

const ACTION_COLOR: Record<ChangeAction, "green" | "amber" | "gray"> = { fill: "green", keep: "amber", same: "gray", unavailable: "gray" };

/**
 * Settings › Import › Specs: upload the sheet, read the preview (what each
 * model gets, what it keeps), confirm. The plan is rebuilt on confirm.
 */
export function SpecImport() {
  const t = useTranslations("specImport");
  const [preview, previewAction] = useActionState<FormState<SpecPreviewData>, FormData>(previewSpecs, {});
  const [applied, applyAction] = useActionState<FormState<SpecImportResult>, FormData>(applySpecs, {});
  const [showAll, setShowAll] = useState(false);
  const data = preview.data;
  const done = applied.ok ? applied.data : undefined;
  const fills = data ? data.plan.models.reduce((n, m) => n + m.changes.filter((c) => c.action === "fill").length, 0) : 0;
  const fillModels = data ? data.plan.models.filter((m) => m.changes.some((c) => c.action === "fill")).length : 0;
  const keeps = data ? data.plan.models.reduce((n, m) => n + m.changes.filter((c) => c.action === "keep").length, 0) : 0;
  const shown = data ? data.plan.models.filter((m) => showAll || m.changes.some((c) => c.action === "fill" || c.action === "keep")) : [];

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
          {t("done", { fields: done.fields, models: done.models })}{" "}
          <button type="button" className="underline" onClick={() => window.location.reload()}>
            {t("another")}
          </button>
        </p>
      ) : (
        data && (
          <ActionForm action={applyAction} className="flex flex-col gap-4">
            <input type="hidden" name="sheet" value={data.text} />
            <input type="hidden" name="fileName" value={data.fileName} />
            <FormError message={applied.error} />
            {data.plan.errors.length > 0 && (
              <div role="alert" className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">
                <p className="font-medium">{t("errors")}</p>
                <ul className="mt-1 list-disc pl-5">
                  {data.plan.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
              <span className="font-medium">{data.fileName}</span>
              <StatusPill color="green">{t("summaryFill", { fields: fills, models: fillModels })}</StatusPill>
              {keeps > 0 && <StatusPill color="amber">{t("summaryKeep", { count: keeps })}</StatusPill>}
              {data.plan.unknownIds.length > 0 && <StatusPill color="red">{t("summaryUnknown", { count: data.plan.unknownIds.length })}</StatusPill>}
              <span className="ml-auto">
                {fills > 0 && data.plan.errors.length === 0 && <SubmitButton pendingText={t("applying")}>{t("apply", { fields: fills, models: fillModels })}</SubmitButton>}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{t("explain")}</p>
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
                  <table className="text-xs">
                    <tbody>
                      {m.changes.map((c) => (
                        <tr key={c.field} className="align-top">
                          <td className="w-32 py-0.5 pr-2 text-muted-foreground">{t(`field_${c.field}`)}</td>
                          <td className="w-28 py-0.5 pr-2">
                            <StatusPill color={ACTION_COLOR[c.action]}>{t(`action_${c.action}`)}</StatusPill>
                          </td>
                          <td className="whitespace-pre-line py-0.5">
                            {c.action === "keep" ? (
                              <>
                                {c.from} <span className="text-muted-foreground">({t("sheetSays", { value: c.to })})</span>
                              </>
                            ) : (
                              c.to
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </li>
              ))}
            </ul>
            {data.plan.unknownIds.length > 0 && (
              <p className="text-sm text-muted-foreground">{t("unknown", { lines: data.plan.unknownIds.map((u) => u.line).join(", ") })}</p>
            )}
          </ActionForm>
        )
      )}
    </div>
  );
}
