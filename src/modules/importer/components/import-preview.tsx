"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { StatusPill } from "@/components/status-pill";
import type { FormState } from "@/lib/forms";
import { confirmImport } from "../actions";
import type { Bucket, PlanRow } from "../plan";

const BUCKET_COLOR: Record<Bucket, "green" | "amber" | "red" | "gray"> = { import: "green", assumption: "amber", decision: "red", parked: "gray" };
const ORDER: Bucket[] = ["decision", "assumption", "import", "parked"];

/** What a row would write, as a short list ("model", "3 bins", "unit U00825"). */
function opsSummary(row: PlanRow, choice?: string): string {
  const ops = row.decision ? (row.decision.options.find((o) => o.key === (choice ?? row.decision!.defaultKey))?.ops ?? []) : row.ops;
  const counts: Record<string, number> = {};
  for (const o of ops) counts[o.type] = (counts[o.type] ?? 0) + (o.type === "bin" ? 1 : o.type === "kit" ? o.count : 1);
  return Object.entries(counts)
    .map(([k, n]) => `${n} ${k}${n === 1 ? "" : "s"}`)
    .join(", ");
}

export function ImportPreview({ id, rows, counts, fileName }: { id: string; rows: PlanRow[]; counts: Record<Bucket, number>; fileName: string }) {
  const t = useTranslations("importer");
  const [state, action] = useActionState<FormState, FormData>(confirmImport, {});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({ decision: true, assumption: true, import: false, parked: false });

  const bySheet = (bucket: Bucket) => {
    const list = rows.filter((r) => r.bucket === bucket);
    const sheets = [...new Set(list.map((r) => r.sheet))];
    return sheets.map((s) => ({ sheet: s, rows: list.filter((r) => r.sheet === s) }));
  };

  return (
    <ActionForm action={action} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={id} />
      <FormError message={state.error} />
      <div className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
        <span className="font-medium">{fileName}</span>
        {ORDER.map((b) => (
          <StatusPill key={b} color={BUCKET_COLOR[b]}>
            {t(`bucket_${b}`)}: {counts[b]}
          </StatusPill>
        ))}
        <span className="ml-auto flex items-center gap-2">
          <SubmitButton pendingText={t("importing")}>{t("confirm", { count: counts.import + counts.assumption + counts.decision })}</SubmitButton>
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{t("explain")}</p>

      {ORDER.map((bucket) => (
        <section key={bucket} className="flex flex-col gap-2">
          <button type="button" className="flex items-center gap-2 text-left text-lg font-medium" onClick={() => setOpen((o) => ({ ...o, [bucket]: !o[bucket] }))} aria-expanded={open[bucket]}>
            <span>{open[bucket] ? "▾" : "▸"}</span>
            {t(`bucket_${bucket}`)} <span className="text-sm font-normal text-muted-foreground">({counts[bucket]})</span>
            <span className="text-sm font-normal text-muted-foreground">· {t(`bucket_${bucket}_help`)}</span>
          </button>
          {open[bucket] &&
            bySheet(bucket).map((g) => (
              <div key={g.sheet} className="flex flex-col gap-1">
                <h3 className="text-sm font-medium text-muted-foreground">{g.sheet}</h3>
                <ul className="divide-y rounded-md border text-sm">
                  {g.rows.map((r) => (
                    <li key={r.key} className="flex flex-col gap-1 px-3 py-2">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="min-w-0 flex-1">{r.summary}</span>
                        <span className="font-mono text-xs text-muted-foreground">{r.src}</span>
                      </div>
                      {r.assumption && <p className="text-xs text-amber-800 dark:text-amber-300">{r.assumption}</p>}
                      {r.parked && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">{r.parked.feature}</span> · {r.parked.detail}
                        </p>
                      )}
                      {r.decision && (
                        <label className="flex flex-col gap-1 text-xs">
                          <span className="text-destructive">{r.decision.question}</span>
                          <NativeSelect name={`decision.${r.key}`} value={choices[r.key] ?? r.decision.defaultKey} onChange={(e) => setChoices((c) => ({ ...c, [r.key]: e.target.value }))} className="h-8 max-w-xl text-xs">
                            {r.decision.options.map((o) => (
                              <option key={o.key} value={o.key}>
                                {o.label}
                              </option>
                            ))}
                          </NativeSelect>
                        </label>
                      )}
                      {bucket !== "parked" && <p className="text-xs text-muted-foreground">{t("writes")}: {opsSummary(r, choices[r.key]) || t("nothing")}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </section>
      ))}
      <div>
        <SubmitButton pendingText={t("importing")}>{t("confirm", { count: counts.import + counts.assumption + counts.decision })}</SubmitButton>
      </div>
    </ActionForm>
  );
}
