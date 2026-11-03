"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { DecimalInput } from "@/components/form/decimal-input";
import { ModelSelect, type ModelChoice } from "@/components/form/model-select";
import { Field, FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { ModelName } from "@/components/model-name";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { appConfig, ITEM_STATUSES, RETIREMENT_REASONS } from "../../../../config/app.config";
import { bulkEditItems, type ItemBulkState } from "../actions";
import type { ItemListRow } from "../queries";

type LocationOption = { id: string; name: string; depth: number };

/**
 * The item list. With `canEdit` every row has a checkbox, and the bar on top
 * edits the selected items in one go: variant (a model of the same family),
 * status, location, supplier, purchase date, purchase price (finance) and
 * not for rental; empty fields stay as
 * each item has them.
 */
export function ItemList({ rows, canEdit, canFinance, locations, models }: { rows: ItemListRow[]; canEdit: boolean; canFinance: boolean; locations: LocationOption[]; models: ModelChoice[] }) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const ts = useTranslations("itemStatus");
  const tr = useTranslations("retiredReason");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action] = useActionState<ItemBulkState, FormData>(bulkEditItems, {});
  const [open, setOpen] = useActionDialog(state);
  const [status, setStatus] = useState("");
  const allIds = rows.map((r) => r.id);
  const live = allIds.filter((id) => selected.has(id));
  const toggle = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      for (const id of ids) if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const err = state.fieldErrors ?? {};
  const refused = state.data?.refused ?? [];
  const def = ITEM_STATUSES.find((s) => s.key === status);
  // Variants to switch to: every model of the families the selected items belong to.
  const families = new Set(rows.filter((r) => selected.has(r.id)).map((r) => r.model.name.toLowerCase()));
  const variants = models.filter((m) => families.has(m.name.toLowerCase()));

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm" aria-live="polite">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4" checked={live.length > 0 && live.length === allIds.length} onChange={(e) => toggle(allIds, e.target.checked)} aria-label={t("selectAll")} />
            {t("itemsSelected", { count: live.length })}
          </label>
          <Button variant="outline" size="sm" className="ml-auto" disabled={live.length === 0} onClick={() => setOpen(true)}>
            {t("bulkEditItems")}
          </Button>
          {state.ok && state.data && (
            <p className="w-full text-muted-foreground">
              {t("bulkEditDone", { done: state.data.done })}
              {refused.length > 0 && ` · ${t("bulkEditRefused", { count: refused.length })}`}
            </p>
          )}
          {refused.length > 0 && (
            <ul className="w-full list-disc rounded-md border border-amber-500/40 bg-amber-500/10 p-2 pl-6 text-xs">
              {refused.map((r) => (
                <li key={r.id}>
                  <span className="font-medium">{r.label}</span>: {r.summary}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ul className="divide-y rounded-md border text-sm">
        {rows.map((i) => (
          <li key={i.id} className="flex items-center">
            {canEdit && (
              <input type="checkbox" className="ml-3 size-4 shrink-0" checked={selected.has(i.id)} onChange={(e) => toggle([i.id], e.target.checked)} aria-label={i.assetTag} />
            )}
            <Link href={`/inventory/items/${i.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 hover:bg-muted/50">
              <span className="w-16 shrink-0 font-mono text-xs">{i.assetTag}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {i.isKit && <span className="mr-1 rounded bg-muted px-1 text-[10px] uppercase">{t("kit")}</span>}
                  {i.name ? `${i.name} · ` : ""}
                  <ModelName model={i.model} />
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {i.model.trackingType === "bulk" ? `×${i.quantity}` : i.serialNumber ? `SN ${i.serialNumber}` : t("noSerial")}
                  {" · "}
                  {i.locationName ?? t("noLocation")}
                  {i.parentLabel ? ` · ${t("inKit")}: ${i.parentLabel}` : ""}
                </span>
              </span>
              <StatusBadge status={i.status} />
            </Link>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("bulkEditTitle", { count: live.length })}</DialogTitle>
            <DialogDescription>{t("bulkEditHelp")}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            {live.map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}
            <FormError message={state.error} />
            <Field id="bulk-modelId" label={t("variant")} error={err.modelId}>
              <ModelSelect id="bulk-modelId" name="modelId" defaultValue="" models={variants} emptyLabel={t("keepAsIs")} />
            </Field>
            <Field id="bulk-status" label={t("status")} error={err.status}>
              <NativeSelect id="bulk-status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{t("keepAsIs")}</option>
                {ITEM_STATUSES.filter((s) => s.manual).map((s) => (
                  <option key={s.key} value={s.key}>
                    {ts(s.key)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {status === "retired" && (
              <Field id="bulk-retiredReason" label={t("retiredReason")} error={err.retiredReason}>
                <NativeSelect id="bulk-retiredReason" name="retiredReason" defaultValue="" required>
                  <option value="">—</option>
                  {RETIREMENT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {tr(r)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {status && (
              <Field id="bulk-reason" label={t("reason")} optional={!def?.reasonRequired} help={t("reasonHelp")} error={err.reason}>
                <Textarea id="bulk-reason" name="reason" rows={2} required={def?.reasonRequired} />
              </Field>
            )}
            <Field id="bulk-locationId" label={t("location")} error={err.locationId}>
              <NativeSelect id="bulk-locationId" name="locationId" defaultValue="__keep__">
                <option value="__keep__">{t("keepAsIs")}</option>
                <option value="__none__">{t("noLocation")}</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {"  ".repeat(l.depth)}
                    {l.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="bulk-supplier" label={t("supplier")} optional error={err.supplier}>
                <Input id="bulk-supplier" name="supplier" />
              </Field>
              <Field id="bulk-purchaseDate" label={t("purchaseDate")} optional error={err.purchaseDate}>
                <Input id="bulk-purchaseDate" name="purchaseDate" type="date" />
              </Field>
              {canFinance && (
                <Field id="bulk-purchasePrice" label={t("purchasePrice", { currency: appConfig.currency })} optional error={err.purchasePrice}>
                  <DecimalInput id="bulk-purchasePrice" name="purchasePrice" />
                </Field>
              )}
              <Field id="bulk-notForRental" label={t("notForRental")} error={err.notForRental}>
                <NativeSelect id="bulk-notForRental" name="notForRental" defaultValue="">
                  <option value="">{t("keepAsIs")}</option>
                  <option value="yes">{tc("yes")}</option>
                  <option value="no">{tc("no")}</option>
                </NativeSelect>
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <SubmitButton pendingText={tc("loading")}>{tc("save")}</SubmitButton>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
