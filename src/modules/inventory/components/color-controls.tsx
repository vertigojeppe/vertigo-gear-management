"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/form/decimal-input";
import { COLOR_PALETTE, colorHex, needsOutline } from "@/lib/colors";
import type { FormState } from "@/lib/forms";
import { cn } from "cn";
import { removeLengthColor, saveLengthColor, setCategoryColor, setCategoryLengthColors } from "../actions";

/** Swatches for a top-level category (admins). The current colour is ringed; "none" clears it. */
export function CategoryColorPicker({ categoryId, color }: { categoryId: string; color: string | null }) {
  const t = useTranslations("colors");
  return (
    <form action={setCategoryColor} className="flex flex-wrap items-center gap-1" aria-label={t("pickColor")}>
      <input type="hidden" name="id" value={categoryId} />
      {COLOR_PALETTE.map((c) => (
        <button
          key={c.key}
          type="submit"
          name="color"
          value={c.key}
          title={t(c.key)}
          aria-label={t(c.key)}
          aria-pressed={color === c.key}
          className={cn("size-5 rounded-full transition-transform hover:scale-110", needsOutline(c.key) && "ring-1 ring-border", color === c.key && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
          style={{ backgroundColor: c.hex }}
        />
      ))}
      <button type="submit" name="color" value="" title={t("none")} aria-label={t("none")} aria-pressed={!color} className={cn("size-5 rounded-full border border-dashed text-[10px] leading-none text-muted-foreground", !color && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}>
        ×
      </button>
    </form>
  );
}

/** "Tape colours by length" toggle for a top-level category (admins). */
export function LengthColorsToggle({ categoryId, on }: { categoryId: string; on: boolean }) {
  const t = useTranslations("colors");
  return (
    <form action={setCategoryLengthColors}>
      <input type="hidden" name="id" value={categoryId} />
      <input type="hidden" name="on" value={on ? "false" : "true"} />
      <Button type="submit" variant={on ? "secondary" : "ghost"} size="xs" title={t("lengthColorsHelp")}>
        {on ? t("lengthColorsOn") : t("lengthColorsOff")}
      </Button>
    </form>
  );
}

export type LengthColorRow = { id: string; metres: number; color: string };

/** The length → colour table (admins): one row per length, add or change at the bottom. */
export function LengthColorsTable({ rows }: { rows: LengthColorRow[] }) {
  const t = useTranslations("colors");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveLengthColor, {});
  const fmt = (m: number) => `${String(m).replace(".", ",")} m`;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-medium">{t("lengthTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("lengthHelp")}</p>
      </div>
      {rows.length > 0 && (
        <ul className="divide-y rounded-md border text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-1.5">
              <span className={cn("size-4 rounded-full", needsOutline(r.color) && "ring-1 ring-border")} style={{ backgroundColor: colorHex(r.color) ?? undefined }} aria-hidden />
              <span className="w-20 font-medium">{fmt(r.metres)}</span>
              <span className="flex-1 text-muted-foreground">{t(r.color as "red")}</span>
              <form action={removeLengthColor}>
                <input type="hidden" name="id" value={r.id} />
                <ConfirmButton confirm={t("removeConfirm", { length: fmt(r.metres) })} variant="ghost" size="xs" className="text-destructive">
                  {tc("delete")}
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      )}
      <ActionForm action={action} className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("metres")}</span>
          <DecimalInput name="metres" placeholder="15" required className="w-24" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("color")}</span>
          <NativeSelect name="color" required className="w-36">
            {COLOR_PALETTE.map((c) => (
              <option key={c.key} value={c.key}>
                {t(c.key)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <SubmitButton variant="outline" size="sm">
          {t("addLength")}
        </SubmitButton>
        <FormError message={state.error ?? state.fieldErrors?.metres} />
      </ActionForm>
    </section>
  );
}
