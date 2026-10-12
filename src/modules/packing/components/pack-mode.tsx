"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Undo2 } from "lucide-react";
import { ActionForm } from "@/components/form/action-form";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { QrScanner } from "@/components/qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseScannedTag } from "@/lib/asset-tag";
import type { FormState } from "@/lib/forms";
import { scanTag, tickLine, untickCheck, type ScanState } from "../actions";
import type { LineRow } from "../queries";

type Ids = { projectId: string; listId: string };

/**
 * Phone-first packing mode. Big tick buttons, a scanner, and a
 * "remaining only" filter. Every tick is a server action; the page
 * re-renders with fresh progress after each one.
 */
export function PackMode({ ids, lines, units, packed }: { ids: Ids; lines: LineRow[]; units: number; packed: number }) {
  const t = useTranslations("packing");
  const [remainingOnly, setRemainingOnly] = useState(true);
  const [scanState, scanAction] = useActionState<ScanState, FormData>(scanTag, {});
  const [manual, setManual] = useState("");

  const submitTag = (text: string) => {
    const tag = parseScannedTag(text) ?? text.trim();
    if (!tag) return;
    const fd = new FormData();
    fd.set("projectId", ids.projectId);
    fd.set("listId", ids.listId);
    fd.set("tag", tag);
    startTransition(() => scanAction(fd));
    setManual("");
  };

  const visible = lines.filter((l) => !remainingOnly || l.progress.toPack > 0);
  const r = scanState.data;
  const scanMessage = !r
    ? null
    : r.status === "ticked"
      ? t("scanned", { tag: r.tag, model: r.modelLabel })
      : r.status === "unknown"
        ? t("scanUnknown", { tag: r.tag })
        : r.status === "not_on_list"
          ? r.alreadyComplete
            ? t("scanComplete", { tag: r.tag, model: r.modelLabel })
            : t("scanNotOnList", { tag: r.tag, model: r.modelLabel })
          : r.message;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border p-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">{t("packed", { packed, total: units })}</span>
          <span className="text-muted-foreground">{units - packed > 0 ? t("stillToPack", { count: units - packed }) : t("allPacked")}</span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-muted">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${units ? Math.min(100, (packed / units) * 100) : 0}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-3">
        <QrScanner onScan={submitTag} id="pack-qr" />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitTag(manual);
          }}
        >
          <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder={t("scanOrType")} aria-label={t("scanOrType")} autoCapitalize="characters" />
          <Button type="submit" variant="outline">
            {t("scan")}
          </Button>
        </form>
        {scanMessage && (
          <p role="status" className={`text-sm ${r?.status === "ticked" ? "text-green-700 dark:text-green-300" : "text-destructive"}`}>
            {scanMessage}
            {r?.status === "not_on_list" && !r.alreadyComplete && (
              <>
                {" "}
                <Link href={`/projects/${ids.projectId}/packing/${ids.listId}?add=${r.modelId}`} className="underline">
                  {t("addToList")}
                </Link>
              </>
            )}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setRemainingOnly((v) => !v)}>
          {remainingOnly ? t("showAll") : t("remainingOnly")}
        </Button>
      </div>

      {visible.length === 0 && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("allPacked")}</p>}

      <ul className="flex flex-col gap-3">
        {visible.map((line) => (
          <li key={line.id} className={`rounded-md border p-3 ${line.progress.toPack === 0 ? "bg-green-500/5" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">
                  {line.quantity}× {line.modelLabel}
                  {line.itemName ? ` – ${line.itemName}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {line.categoryPath.join(" › ")}
                  {line.caseLabel && !line.isKit ? ` · ${t("case")}: ${line.caseLabel}` : ""}
                  {line.note && line.note !== line.itemName ? ` · ${line.note}` : ""}
                </p>
                {line.isKit && line.kitContents.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("contains")}: {line.kitContents.map((c) => `${c.quantity > 1 ? `${c.quantity}× ` : ""}${c.label}`).join(", ")}
                  </p>
                )}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${line.progress.toPack === 0 ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200" : "bg-muted"}`}>
                {line.progress.packed}/{line.quantity}
              </span>
            </div>

            {line.checks.filter((c) => c.phase === "out").length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {line.checks
                  .filter((c) => c.phase === "out")
                  .map((c) => (
                    <li key={c.id} className="flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs">
                      <Check className="size-3 text-green-600" aria-hidden />
                      {c.assetTag ?? (line.trackingType === "bulk" ? `${c.quantity}×` : "")}
                      {line.trackingType === "bulk" && c.assetTag ? ` ×${c.quantity}` : ""}
                      <form action={untickCheck} className="inline">
                        <input type="hidden" name="projectId" value={ids.projectId} />
                        <input type="hidden" name="listId" value={ids.listId} />
                        <input type="hidden" name="checkId" value={c.id} />
                        <button type="submit" className="ml-1 text-muted-foreground hover:text-foreground" aria-label={t("untick")} title={t("untick")}>
                          <Undo2 className="size-3" aria-hidden />
                        </button>
                      </form>
                    </li>
                  ))}
              </ul>
            )}

            {line.progress.toPack > 0 && <TickForm ids={ids} line={line} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TickForm({ ids, line }: { ids: Ids; line: LineRow }) {
  const t = useTranslations("packing");
  const [state, action] = useActionState<FormState, FormData>(tickLine, {});
  const err = state.error ?? state.fieldErrors?.itemId ?? state.fieldErrors?.quantity;

  return (
    <ActionForm action={action} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="projectId" value={ids.projectId} />
      <input type="hidden" name="listId" value={ids.listId} />
      <input type="hidden" name="lineId" value={line.id} />
      {line.trackingType === "bulk" ? (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("bin")}
            <NativeSelect name="itemId" defaultValue={line.bins[0]?.id ?? ""} className="h-9 w-44">
              {line.bins.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.assetTag} · {b.quantity}
                  {b.locationName ? ` · ${b.locationName}` : ""}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("takeQuantity")}
            <Input key={line.progress.toPack} name="quantity" type="number" min="1" max={line.progress.toPack} step="1" defaultValue={String(line.progress.toPack)} className="h-9 w-20" />
          </label>
          <SubmitButton size="lg" className="h-9">
            <Check aria-hidden /> {t("tick")}
          </SubmitButton>
        </>
      ) : line.itemId ? (
        <>
          <input type="hidden" name="itemId" value={line.itemId} />
          <SubmitButton size="lg" className="h-9">
            <Check aria-hidden /> {t("tick")} {line.itemTag}
          </SubmitButton>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("chooseUnit")}
            <NativeSelect name="itemId" defaultValue={line.availableUnits[0]?.id ?? ""} className="h-9 w-48">
              {line.availableUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.assetTag}
                  {u.serialNumber ? ` · SN ${u.serialNumber}` : ""}
                </option>
              ))}
            </NativeSelect>
          </label>
          <SubmitButton size="lg" className="h-9" disabled={line.availableUnits.length === 0}>
            <Check aria-hidden /> {t("tickUnit")}
          </SubmitButton>
        </>
      )}
      {err && (
        <p role="alert" className="w-full text-xs text-destructive">
          {err}
        </p>
      )}
    </ActionForm>
  );
}
