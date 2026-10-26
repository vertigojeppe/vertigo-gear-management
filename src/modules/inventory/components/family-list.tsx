"use client";

import { ColorBar, ColorDot } from "@/components/color-marks";
import { formatQty } from "../consumables-logic";
import { Fragment, useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Package } from "lucide-react";
import { ActionForm } from "@/components/form/action-form";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { familyLabel, modelLabel } from "@/lib/format";
import { ModelName } from "@/components/model-name";
import { bulkModels, type BulkState } from "../actions";
import type { ModelFamily, ModelListRow } from "../queries";
import type { ModelSort } from "../sorting";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

/**
 * The inventory list: one row per family that opens to its variants, with
 * a checkbox on every row. Selected models get a bar with Archive,
 * Unarchive and Delete. Delete reports what is still in use; an admin can
 * then delete anyway, which removes the reservations, lines and items
 * that point at those models.
 */
export function FamilyList({ families, sort = "name", canEdit, isAdmin, returnTo }: { families: ModelFamily[]; sort?: ModelSort; canEdit: boolean; isAdmin: boolean; returnTo: string }) {
  const t = useTranslations("inventory");
  /** The value the list is sorted by, shown on each row, so the order explains itself. */
  const metric = (f: ModelFamily): string | null => {
    switch (sort) {
      case "out":
        return t("metric.out", { count: f.owned - f.inHouse });
      case "packed":
        return t("metric.packed", { count: f.packed });
      case "newest":
        return t("metric.added", { date: formatDate(f.addedAt) });
      case "price":
        return f.dayPrice !== null ? t("metric.price", { price: formatMoney(f.dayPrice) }) : null;
      case "weight":
        return f.weightKg !== null ? t("metric.weight", { kg: formatNumber(f.weightKg, 1) }) : null;
      default:
        return null;
    }
  };
  const withMetric = (base: string, f: ModelFamily) => [base, metric(f)].filter(Boolean).join(" · ");
  const tc = useTranslations("common");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action] = useActionState<BulkState, FormData>(bulkModels, {});
  const allIds = families.flatMap((f) => f.variants.map((v) => v.id));
  const live = [...selected].filter((id) => allIds.includes(id));
  const toggle = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      for (const id of ids) if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const tracking = (f: ModelFamily) => (f.trackingType === "mixed" ? `${t("serialized")} + ${t("bulk")}` : t(f.trackingType));
  const refused = state.data?.refused ?? [];
  // Models without sizes share one set of columns across the page, so their values line up like a table.
  const singleColumns = specColumns(families.filter((f) => f.variants.length === 1).map((f) => f.variants[0]));

  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm" aria-live="polite">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4" checked={allIds.length > 0 && live.length === allIds.length} onChange={(e) => toggle(allIds, e.target.checked)} aria-label={t("selectAll")} />
            {t("selectedCount", { count: live.length })}
          </label>
          <input type="hidden" name="returnTo" value={returnTo} />
          {live.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <span className="ml-auto flex flex-wrap gap-2">
            <SubmitButton name="op" value="archive" variant="outline" size="sm" disabled={live.length === 0}>
              {t("archive")}
            </SubmitButton>
            <SubmitButton name="op" value="unarchive" variant="outline" size="sm" disabled={live.length === 0}>
              {t("unarchive")}
            </SubmitButton>
            <SubmitButton name="op" value="delete" variant="outline" size="sm" className="text-destructive" disabled={live.length === 0} onClick={(e) => !window.confirm(t("bulkDeleteConfirm", { count: live.length })) && e.preventDefault()}>
              {tc("delete")}
            </SubmitButton>
          </span>
          {state.error && <p className="w-full text-destructive">{state.error}</p>}
          {state.ok && state.data && (
            <p className="w-full text-muted-foreground">
              {t("bulkDone", { done: state.data.done, op: state.data.op })} · {t("bulkRefused", { count: refused.length })}
            </p>
          )}
          {refused.length > 0 && (
            <div className="w-full rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
              <ul className="list-disc pl-4">
                {refused.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium">{r.label}</span>: {r.summary}
                  </li>
                ))}
              </ul>
              {isAdmin ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {refused.map((r) => (
                    <input key={r.id} type="hidden" name="forceIds" value={r.id} />
                  ))}
                  <Button type="submit" name="op" value="force-delete" variant="destructive" size="sm" onClick={(e) => !window.confirm(t("forceDeleteConfirm", { count: refused.length })) && e.preventDefault()}>
                    {t("deleteAnyway", { count: refused.length })}
                  </Button>
                  <span className="text-muted-foreground">{t("deleteAnywayHelp")}</span>
                </div>
              ) : (
                <p className="mt-1 text-muted-foreground">{t("askAdmin")}</p>
              )}
            </div>
          )}
        </div>
      )}

      <ul className="divide-y rounded-md border">
        {families.map((f, i) => {
          const ids = f.variants.map((v) => v.id);
          const picked = ids.filter((id) => selected.has(id)).length;
          // Sorted by category: a heading wherever the category changes.
          const path = f.categoryPath.join(" › ");
          const heading = sort === "category" && (i === 0 || families[i - 1].categoryPath.join(" › ") !== path) && (
            <li className="bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">{path || "—"}</li>
          );
          if (f.variants.length === 1) {
            const v = f.variants[0];
            return (
              <Fragment key={f.key}>
                {heading}
                <li className="flex items-center">
                <ColorBar color={f.color} className="ml-1" />
                {canEdit && <Check checked={selected.has(v.id)} onChange={(on) => toggle([v.id], on)} label={modelLabel(v)} />}
                <ColorDot color={v.lengthColor} className="ml-3" />
                <ModelRow m={v} label={modelLabel(v)} maker={v.manufacturer} sub={withMetric(`${f.categoryPath.join(" › ")} · ${t(v.trackingType)}`, f)} archivedLabel={t("archived")} inHouseLabel={t("inHouse")} columns={singleColumns} />
                </li>
              </Fragment>
            );
          }
          return (
            <Fragment key={f.key}>
              {heading}
              <li>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                  <ColorBar color={f.color} className="ml-1" />
                  {canEdit && <Check checked={picked === ids.length} indeterminate={picked > 0 && picked < ids.length} onChange={(on) => toggle(ids, on)} label={familyLabel(f)} />}
                  <span className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
                    <Thumb url={f.thumbUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        <ModelName model={f} maker={f.manufacturer} />
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{t("variantCount", { count: f.variants.length })}</span>
                        {f.archived && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{t("archived")}</span>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {withMetric(`${f.categoryPath.join(" › ")} · ${tracking(f)} · ${f.variants.map((v) => v.variant ?? "—").join(", ")}`, f)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm">
                      <span className="block">
                        <span className="font-medium">{f.inHouse}</span>
                        <span className="text-muted-foreground"> / {f.owned}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">{t("inHouse")}</span>
                    </span>
                    <span className="text-muted-foreground transition-transform group-open:rotate-90" aria-hidden>
                      ›
                    </span>
                  </span>
                </summary>
                <ul className="divide-y border-t bg-muted/20">
                  {f.variants.map((v, _, all) => (
                    <li key={v.id} className="flex items-center pl-6">
                      {canEdit && <Check checked={selected.has(v.id)} onChange={(on) => toggle([v.id], on)} label={modelLabel(v)} />}
                      <ColorDot color={v.lengthColor} className="ml-3" />
                      <ModelRow m={v} label={v.variant ?? modelLabel(v)} maker={f.manufacturer.includes(",") ? v.manufacturer : ""} sub={v.trackingType !== f.trackingType ? t(v.trackingType) : ""} archivedLabel={t("archived")} inHouseLabel={t("inHouse")} compact columns={specColumns(all)} />
                    </li>
                  ))}
                </ul>
              </details>
              </li>
            </Fragment>
          );
        })}
      </ul>
    </ActionForm>
  );
}

/** A value shown on a row: weight, power draw, and extra fields marked "show in the inventory list". */
type Spec = { key: string; text: string };
type SpecColumn = { key: string; ch: number };

function specsOf(m: ModelListRow): Spec[] {
  const out: Spec[] = [];
  if (m.weightKg !== null) out.push({ key: "weight", text: `${formatNumber(m.weightKg, 2)} kg` });
  if (m.powerDrawW !== null) out.push({ key: "power", text: `${formatNumber(m.powerDrawW, 0)} W` });
  for (const f of m.listFields) out.push({ key: `cf.${f.key}`, text: f.text });
  return out;
}

/** The columns a family's rows share: every value any size has, as wide as its longest text, so they line up. */
function specColumns(rows: ModelListRow[]): SpecColumn[] {
  const cols = new Map<string, number>();
  for (const r of rows) for (const sp of specsOf(r)) cols.set(sp.key, Math.max(cols.get(sp.key) ?? 0, sp.text.length));
  return [...cols].map(([key, ch]) => ({ key, ch }));
}

function Check({ checked, indeterminate = false, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      className="ml-3 size-4 shrink-0"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
    />
  );
}

function Thumb({ url }: { url: string | null }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <Package className="size-5" aria-hidden />
      )}
    </span>
  );
}

function ModelRow({ m, label, maker = "", sub, archivedLabel, inHouseLabel, compact = false, columns }: { m: ModelListRow; label: string; maker?: string; sub: string; archivedLabel: string; inHouseLabel: string; compact?: boolean; columns: SpecColumn[] }) {
  const specs = new Map(specsOf(m).map((sp) => [sp.key, sp.text]));
  return (
    <Link href={`/inventory/models/${m.id}`} className={`flex min-w-0 flex-1 items-center gap-3 px-3 hover:bg-muted/50 ${compact ? "py-1.5" : "py-2"}`}>
      {!compact && <Thumb url={m.thumbUrl} />}
      {/* On wide screens the name has a fixed width and the values follow it as columns; the count stays at the far right. */}
      <span className={`min-w-0 flex-1 ${columns.length > 0 ? (compact ? "lg:w-72 lg:flex-none" : "lg:w-80 lg:flex-none") : ""}`}>
        <span className={`block truncate ${compact ? "" : "font-medium"}`}>
          {label}
          {maker && <> <span className="ml-1 text-[0.85em] font-normal text-muted-foreground">{maker}</span></>}
          {m.archived && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{archivedLabel}</span>}
        </span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
        {specs.size > 0 && <span className="block truncate text-xs text-muted-foreground lg:hidden">{[...specs.values()].join(" · ")}</span>}
      </span>
      {columns.length > 0 && (
        <span className="hidden shrink-0 gap-5 text-sm tabular-nums text-muted-foreground lg:flex">
          {columns.map((c) => (
            <span key={c.key} className="whitespace-nowrap" style={{ width: `${c.ch + 1}ch` }}>
              {specs.get(c.key) ?? ""}
            </span>
          ))}
        </span>
      )}
      {columns.length > 0 && <span className="hidden flex-1 lg:block" />}
      <span className="shrink-0 text-right text-sm">
        <span className="block">
          {m.consumable && m.unit === "m" ? (
            <span className="font-medium">{formatQty(m.inHouse, "m")}</span>
          ) : (
            <>
              <span className="font-medium">{m.inHouse}</span>
              <span className="text-muted-foreground"> / {m.owned}</span>
            </>
          )}
        </span>
        {!compact && <span className="block text-xs text-muted-foreground">{inHouseLabel}</span>}
      </span>
    </Link>
  );
}
