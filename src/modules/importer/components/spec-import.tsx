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

function changeLabel(c: SpecChange, ticked: boolean) {
  if (c.action === "fill") return ticked ? { key: "action_fill", color: "green" } : { key: "action_skip", color: "gray" };
  if (c.action === "keep") return ticked ? { key: "action_replace", color: "amber" } : { key: "action_keep", color: "gray" };
  return { key: `action_${c.action}`, color: "gray" };
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
            <table className="text-xs">
              <tbody>
                {m.changes.map((c) => {
                  const key = pickKey(m.id, c.field);
                  const ticked = picked.has(key);
                  const label = changeLabel(c, ticked);
                  return (
                    <tr key={c.field} className="align-top">
                      <td className="w-6 py-0.5">
                        {pickable(c.action) && (
                          <input type="checkbox" name="pick" value={key} checked={ticked} onChange={(e) => toggle(key, e.target.checked)} aria-label={`${(c.label ?? t(`field_${c.field}`))}: ${m.label}`} className="mt-0.5" />
                        )}
                      </td>
                      <td className="w-32 py-0.5 pr-2 text-muted-foreground">{(c.label ?? t(`field_${c.field}`))}</td>
                      <td className="w-28 py-0.5 pr-2">
                        <StatusPill color={label.color}>{t(label.key)}</StatusPill>
                      </td>
                      <td className="whitespace-pre-line py-0.5">
                        {c.action === "keep" ? (
                          <>
                            <span className={ticked ? "line-through text-muted-foreground" : ""}>{c.from}</span>{" "}
                            <span className={ticked ? "" : "text-muted-foreground"}>({t("sheetSays", { value: c.to })})</span>
                          </>
                        ) : (
                          <span className={c.action === "fill" && !ticked ? "text-muted-foreground" : ""}>{c.to}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </li>
        ))}
      </ul>
      {plan.unknownIds.length > 0 && <p className="text-sm text-muted-foreground">{t("unknown", { lines: plan.unknownIds.map((u) => u.line).join(", ") })}</p>}
    </ActionForm>
  );
}
