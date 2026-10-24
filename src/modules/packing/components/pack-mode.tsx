"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, CheckCheck, Undo2 } from "lucide-react";
import { ActionForm } from "@/components/form/action-form";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { QrScanner } from "@/components/qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseScannedTag } from "@/lib/asset-tag";
import type { FormState } from "@/lib/forms";
import { scanTag, tickAllUnits, tickLine, untickCheck, type ScanState } from "../actions";
import type { LineRow } from "../queries";

type Ids = { projectId: string; listId: string };

/** Lines packed this recently stay with the remaining ones, so a wrong tick can still be undone where it happened. */
const RECENT_MS = 15 * 60_000;

/**
 * Phone-first packing mode. Big tick buttons and a scanner. Lines still to
 * pack come first, together with lines packed in the last 15 minutes; older
 * finished lines fold into "Packed" at the bottom. Every packed unit or
 * quantity has an Undo button, and so has the last scan or tick. Every
 * tick is a server action; the page re-renders with fresh progress after
 * each one.
 */
export function PackMode({ ids, lines, units, packed }: { ids: Ids; lines: LineRow[]; units: number; packed: number }) {
  const t = useTranslations("packing");
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

  // Date.now() at render: the 15 minutes are counted from when the page last loaded, which every tick refreshes.
  // eslint-disable-next-line react-hooks/purity -- a render-time cut-off is what we want here
  const recent = Date.now() - RECENT_MS;
  const packedRecently = (l: LineRow) => l.checks.some((c) => c.phase === "out" && new Date(c.checkedAt).getTime() > recent);
  const current = lines.filter((l) => l.progress.toPack > 0 || packedRecently(l));
  const done = lines.filter((l) => !current.includes(l));
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
      {/* With the roomy layout (Settings › Layout), progress and scanner sit side by side and the lines fill a grid on wide screens. */}
      <div className="flex flex-col gap-4 roomy:lg:grid roomy:lg:grid-cols-2 roomy:lg:items-start">
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
            <p role="status" className={`flex flex-wrap items-center gap-2 text-sm ${r?.status === "ticked" ? "text-green-700 dark:text-green-300" : "text-destructive"}`}>
              {scanMessage}
              {r?.status === "ticked" && <UndoTick key={r.checkId} ids={ids} checkId={r.checkId} label={r.tag} />}
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
      </div>

      {current.length === 0 && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("allPacked")}</p>}

      <ul className="grid items-start gap-3 roomy:lg:grid-cols-2 roomy:2xl:grid-cols-3">
        {current.map((line) => (
          <LineCard key={line.id} ids={ids} line={line} />
        ))}
      </ul>

      {done.length > 0 && (
        <details className="group rounded-md border">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            {t("packedLines", { count: done.length })} <span className="text-muted-foreground transition-transform group-open:rotate-90">›</span>
          </summary>
          <ul className="grid items-start gap-3 roomy:lg:grid-cols-2 roomy:2xl:grid-cols-3 border-t p-3">
            {done.map((line) => (
              <LineCard key={line.id} ids={ids} line={line} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function LineCard({ ids, line }: { ids: Ids; line: LineRow }) {
  const t = useTranslations("packing");
  const out = line.checks.filter((c) => c.phase === "out");
  return (
    <li className={`rounded-md border p-3 ${line.progress.toPack === 0 ? "bg-green-500/5" : ""}`}>
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
          {!line.isKit && line.quantity > line.inHouse && <p className="text-xs text-amber-700 dark:text-amber-300">{t("inHouseHint", { count: line.inHouse, owned: line.owned })}</p>}
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

      {out.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {out.map((c) => {
            const what = [c.assetTag, line.trackingType === "bulk" ? `×${c.quantity}` : null].filter(Boolean).join(" ");
            return (
              <li key={c.id} className="flex items-center gap-1.5 rounded-full border bg-background py-0.5 pl-2 pr-0.5 text-xs">
                <Check className="size-3 text-green-600" aria-hidden />
                {what}
                <UndoTick ids={ids} checkId={c.id} label={`${line.modelLabel} ${what}`.trim()} compact />
              </li>
            );
          })}
        </ul>
      )}

      {line.progress.toPack > 0 && <TickForm ids={ids} line={line} />}
    </li>
  );
}

/** Takes one tick back (a unit, or a bulk quantity). Safe to tap twice; says why when the list has been checked out. */
function UndoTick({ ids, checkId, label, compact = false }: { ids: Ids; checkId: string; label: string; compact?: boolean }) {
  const t = useTranslations("packing");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  if (result?.ok && !compact) return <span className="text-xs text-muted-foreground">{t("undone")}</span>;
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set("projectId", ids.projectId);
            fd.set("listId", ids.listId);
            fd.set("checkId", checkId);
            setResult(await untickCheck(fd));
          })
        }
        className={`inline-flex items-center gap-1 rounded-full border px-2 text-xs text-foreground hover:bg-muted disabled:opacity-50 ${compact ? "h-6" : "h-7"}`}
        aria-label={`${t("untick")} ${label}`}
      >
        <Undo2 className="size-3" aria-hidden />
        {t("untick")}
      </button>
      {result?.error && (
        <span role="alert" className="text-xs text-destructive">
          {result.error}
        </span>
      )}
    </>
  );
}

function TickForm({ ids, line }: { ids: Ids; line: LineRow }) {
  const t = useTranslations("packing");
  const [state, action] = useActionState<FormState<{ checkId: string }>, FormData>(tickLine, {});
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
      {!line.itemId && line.trackingType !== "bulk" && line.progress.toPack > 1 && line.availableUnits.length > 0 && <PackAllButton ids={ids} line={line} />}
      {err && (
        <p role="alert" className="w-full text-xs text-destructive">
          {err}
        </p>
      )}
    </ActionForm>
  );
}

/**
 * Packs every unit a serialized line still needs in one tap: the first
 * in-house units in asset-tag order. Says so when fewer are in house; each
 * packed unit can be undone on its own.
 */
function PackAllButton({ ids, line }: { ids: Ids; line: LineRow }) {
  const t = useTranslations("packing");
  const [state, action, pending] = useActionState<FormState<{ packed: number; missing: number }>, FormData>(tickAllUnits, {});
  const count = Math.min(line.progress.toPack, line.availableUnits.length);
  return (
    <>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-9"
        disabled={pending}
        onClick={() => {
          const fd = new FormData();
          fd.set("projectId", ids.projectId);
          fd.set("listId", ids.listId);
          fd.set("lineId", line.id);
          startTransition(() => action(fd));
        }}
        aria-label={`${t("packAll", { count })} ${line.modelLabel}`}
      >
        <CheckCheck aria-hidden /> {t("packAll", { count })}
      </Button>
      {state.ok && state.data && state.data.missing > 0 && <p className="w-full text-xs text-amber-700 dark:text-amber-300">{t("packAllShort", { packed: state.data.packed, missing: state.data.missing })}</p>}
      {state.error && (
        <p role="alert" className="w-full text-xs text-destructive">
          {state.error}
        </p>
      )}
    </>
  );
}
