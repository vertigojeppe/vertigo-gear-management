"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { ConfirmButton } from "@/components/form/confirm-button";
import { Field, FormError, FormSuccess } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/form/decimal-input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { RATE_EXTRA_RULES, type RateExtraRule } from "../../../../config/app.config";
import { deleteRateTable, saveRateTable } from "../actions";
import { factorFor, type RateTier } from "../engine";
import type { RateTableDto } from "../service";

type Row = { key: number; days: string; factor: string };

/** Rate table editor: name, default flag, tiers as editable rows, the rule beyond the last tier, and a live factor preview. */
export function RateTableForm({ table }: { table?: RateTableDto }) {
  const t = useTranslations("pricing");
  const tr = useTranslations("rateExtraRule");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveRateTable, {});
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | number | null | undefined) => (state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback));
  const initialRows: Row[] = (table?.tiers.length ? table.tiers : [{ days: 1, factor: 1 }]).map((x, i) => ({ key: i, days: String(x.days), factor: String(x.factor) }));
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [extraRule, setExtraRule] = useState<string>(v("extraRule", table?.extraRule ?? "none"));
  const [extraFactor, setExtraFactor] = useState<string>(v("extraFactor", table?.extraFactor ?? 0));
  const [previewDays, setPreviewDays] = useState("3");

  const tiers: RateTier[] = rows.map((r) => ({ days: Number(r.days), factor: Number(r.factor.replace(",", ".")) })).filter((x) => Number.isInteger(x.days) && x.days > 0 && Number.isFinite(x.factor));
  const preview = tiers.length ? factorFor({ tiers, extraRule: extraRule as RateExtraRule, extraFactor: Number(extraFactor.replace(",", ".")) || 0 }, Number(previewDays) || 1) : null;
  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <ActionForm action={action} className="flex max-w-2xl flex-col gap-6">
      {table && <input type="hidden" name="id" value={table.id} />}
      <FormError message={state.error} />
      <FormSuccess message={state.ok && table ? tc("saved") : undefined} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="rt-name" label={t("tableName")} error={err.name}>
          <Input id="rt-name" name="name" defaultValue={v("name", table?.name)} required autoFocus={!table} />
        </Field>
        <label className="flex items-start gap-2 pt-6 text-sm">
          <input type="checkbox" name="isDefault" className="mt-0.5 size-4" defaultChecked={state.values ? state.values.isDefault === "on" : Boolean(table?.isDefault)} />
          <span>
            {t("isDefault")}
            <span className="block text-xs text-muted-foreground">{t("isDefaultHelp")}</span>
          </span>
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("tiers")}</legend>
        <p className="text-xs text-muted-foreground">{t("tiersHelp")}</p>
        {err.tiers && (
          <p role="alert" className="text-sm text-destructive">
            {err.tiers}
          </p>
        )}
        <div className="grid grid-cols-[6rem_8rem_auto] items-center gap-2 text-xs text-muted-foreground">
          <span>{t("days")}</span>
          <span>{t("factor")}</span>
          <span />
          {rows.map((r, i) => (
            <div key={r.key} className="contents">
              <Input name="tierDays" type="number" min="1" step="1" value={r.days} onChange={(e) => setRow(r.key, { days: e.target.value })} aria-label={`${t("days")} ${i + 1}`} className="h-8 text-sm" />
              <DecimalInput name="tierFactor" value={r.factor} onChange={(e) => setRow(r.key, { factor: e.target.value })} aria-label={`${t("factor")} ${i + 1}`} className="h-8 text-sm" />
              <Button type="button" variant="ghost" size="xs" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} disabled={rows.length === 1} aria-label={t("removeTier")}>
                ×
              </Button>
            </div>
          ))}
        </div>
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { key: Date.now(), days: "", factor: "" }])}>
            {t("addTier")}
          </Button>
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="rt-rule" label={t("extraRule")} help={t("extraRuleHelp")} error={err.extraRule}>
          <NativeSelect id="rt-rule" name="extraRule" value={extraRule} onChange={(e) => setExtraRule(e.target.value)}>
            {RATE_EXTRA_RULES.map((r) => (
              <option key={r.key} value={r.key}>
                {tr(r.key)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="rt-extra" label={t("extraFactor")} error={err.extraFactor}>
          <DecimalInput id="rt-extra" name="extraFactor" value={extraFactor} onChange={(e) => setExtraFactor(e.target.value)} disabled={extraRule === "none"} />
        </Field>
      </div>

      <Field id="rt-notes" label={t("notes")} optional error={err.notes}>
        <Textarea id="rt-notes" name="notes" rows={2} defaultValue={v("notes", table?.notes)} />
      </Field>

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm">
        <label htmlFor="rt-preview" className="text-muted-foreground">
          {t("previewLabel")}
        </label>
        <Input id="rt-preview" type="number" min="1" step="1" value={previewDays} onChange={(e) => setPreviewDays(e.target.value)} className="h-8 w-20" />
        <span>
          {t("previewFactor")}: <strong data-testid="factor-preview">{preview ?? "–"}</strong>
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingText={tc("loading")}>{table ? tc("save") : tc("create")}</SubmitButton>
        <Link href="/settings/pricing" className={buttonVariants({ variant: "outline" })}>
          {tc("cancel")}
        </Link>
      </div>
    </ActionForm>
  );
}

export function DeleteRateTableButton({ id }: { id: string }) {
  const t = useTranslations("pricing");
  return (
    <form action={deleteRateTable}>
      <input type="hidden" name="id" value={id} />
      <ConfirmButton confirm={t("deleteConfirm")} variant="outline" size="sm" className="text-destructive">
        {t("deleteTable")}
      </ConfirmButton>
    </form>
  );
}
