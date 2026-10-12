"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Undo2 } from "lucide-react";
import { ActionForm } from "@/components/form/action-form";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/forms";
import { CHECK_OUTCOMES } from "../../../../config/app.config";
import { checkInUnit, undoReturn } from "../actions";
import type { LineRow } from "../queries";

type Ids = { projectId: string; listId: string };

/** Check-in mode: for every unit that went out, record what came back. */
export function CheckInMode({ ids, lines }: { ids: Ids; lines: LineRow[] }) {
  const t = useTranslations("packing");
  const to = useTranslations("checkOutcome");
  const [remainingOnly, setRemainingOnly] = useState(true);
  const withOut = lines.filter((l) => l.checks.some((c) => c.phase === "out"));
  // "Remaining only" keeps lines with a return in the last 15 minutes, so a wrong tap can still be undone.
  const recent = Date.now() - 15 * 60_000;
  const visible = withOut.filter((l) => !remainingOnly || l.progress.toReturn > 0 || l.checks.some((c) => c.phase === "in" && new Date(c.checkedAt).getTime() > recent));
  const totalOut = withOut.reduce((s, l) => s + l.progress.packed, 0);
  const totalBack = withOut.reduce((s, l) => s + l.progress.packed - l.progress.toReturn, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border p-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">{t("returned", { returned: totalBack, packed: totalOut })}</span>
          <button type="button" className="text-xs underline" onClick={() => setRemainingOnly((v) => !v)}>
            {remainingOnly ? t("showAll") : t("remainingOnly")}
          </button>
        </div>
        <div className="h-2 overflow-hidden rounded bg-muted">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${totalOut ? Math.min(100, (totalBack / totalOut) * 100) : 0}%` }} />
        </div>
      </div>

      {visible.length === 0 && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("allReturned")}</p>}

      <ul className="flex flex-col gap-3">
        {visible.map((line) => (
          <li key={line.id} className="rounded-md border p-3">
            <p className="font-medium">
              {line.quantity}× {line.modelLabel}
              {line.itemName ? ` – ${line.itemName}` : ""}
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {line.checks
                .filter((c) => c.phase === "out")
                .map((c) => {
                  const remaining = c.quantity - c.returned;
                  const inRows = line.checks.filter((x) => x.phase === "in" && (x.outCheckId ? x.outCheckId === c.id : x.itemId === c.itemId));
                  return (
                    <li key={c.id} className="rounded border bg-background p-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-mono text-xs">{c.assetTag ?? "—"}</span>
                        {line.trackingType === "bulk" && <span className="text-xs text-muted-foreground">×{c.quantity}</span>}
                        {inRows.map((x) => (
                          <span key={x.id} className={`rounded-full px-2 py-0.5 text-xs ${x.outcome === "ok" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200" : x.outcome === "damaged" ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"}`}>
                            {line.trackingType === "bulk" ? `${x.quantity}× ` : ""}
                            {to(x.outcome as "ok")}
                            {x.note ? ` · ${x.note}` : ""}
                            <form action={undoReturn} className="ml-1 inline">
                              <input type="hidden" name="projectId" value={ids.projectId} />
                              <input type="hidden" name="listId" value={ids.listId} />
                              <input type="hidden" name="checkId" value={x.id} />
                              <button type="submit" className="align-middle opacity-70 hover:opacity-100" aria-label={t("undoReturn")} title={t("undoReturn")}>
                                <Undo2 className="size-3" aria-hidden />
                              </button>
                            </form>
                          </span>
                        ))}
                        {remaining <= 0 && inRows.length === 0 && <span className="text-xs text-muted-foreground">{to("ok")}</span>}
                      </div>
                      {remaining > 0 && <OutcomeForm ids={ids} outCheckId={c.id} bulk={line.trackingType === "bulk"} remaining={remaining} />}
                    </li>
                  );
                })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OutcomeForm({ ids, outCheckId, bulk, remaining }: { ids: Ids; outCheckId: string; bulk: boolean; remaining: number }) {
  const t = useTranslations("packing");
  const [state, action] = useActionState<FormState, FormData>(checkInUnit, {});
  return (
    <ActionForm action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="projectId" value={ids.projectId} />
      <input type="hidden" name="listId" value={ids.listId} />
      <input type="hidden" name="outCheckId" value={outCheckId} />
      {bulk && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("returnQuantity")}
          <Input key={remaining} name="quantity" type="number" min="1" max={remaining} step="1" defaultValue={String(remaining)} className="h-9 w-20" />
        </label>
      )}
      <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs text-muted-foreground">
        {t("note")}
        <Input name="note" className="h-9" />
      </label>
      <div className="flex gap-1">
        {CHECK_OUTCOMES.map((o) => (
          <SubmitButton
            key={o.key}
            name="outcome"
            value={o.key}
            size="sm"
            className="h-9"
            variant={o.key === "ok" ? "default" : "outline"}
          >
            {t(o.key === "ok" ? "outcomeOk" : o.key === "damaged" ? "outcomeDamaged" : "outcomeMissing")}
          </SubmitButton>
        ))}
      </div>
      {(state.error || state.fieldErrors) && (
        <p role="alert" className="w-full text-xs text-destructive">
          {state.error ?? Object.values(state.fieldErrors ?? {})[0]}
        </p>
      )}
    </ActionForm>
  );
}
