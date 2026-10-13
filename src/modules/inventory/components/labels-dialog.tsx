"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LABEL_SIZES } from "../../../../config/app.config";

/**
 * "Print labels": choose a label size and, for sheets, how many cells of
 * the first sheet are already used; opens the PDF for the given items
 * (`query`: ids=… or the item list's filters). The browser's origin goes
 * along so QR codes point at the address the user is on (see QrImage).
 */
export function LabelsDialog({ query, count, variant = "outline" }: { query: string; count: number; variant?: "outline" | "ghost" | "default" }) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<string>(LABEL_SIZES[0].key);
  const [offset, setOffset] = useState("0");
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const chosen = LABEL_SIZES.find((s) => s.key === size) ?? LABEL_SIZES[0];
  const perSheet = chosen.columns * chosen.rows;
  const href = `/api/labels/sheet.pdf?${query}&size=${size}${chosen.page !== "single" ? `&offset=${Math.max(0, Number(offset) || 0)}` : ""}${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`;
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)} disabled={count === 0}>
        {t("printLabels")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("printLabels")}</DialogTitle>
            <DialogDescription>{t("labelsHelp", { count })}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field id="label-size" label={t("labelSize")}>
              <NativeSelect id="label-size" value={size} onChange={(e) => setSize(e.target.value)}>
                {LABEL_SIZES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {chosen.page !== "single" && (
              <Field id="label-offset" label={t("labelOffset")} help={t("labelOffsetHelp", { perSheet })}>
                <Input id="label-offset" type="number" min="0" max={perSheet - 1} step="1" value={offset} onChange={(e) => setOffset(e.target.value)} className="w-24" />
              </Field>
            )}
            <p className="text-xs text-muted-foreground">{chosen.page === "single" ? t("labelsSingleNote", { count }) : t("labelsSheetNote", { sheets: Math.ceil((count + (Number(offset) || 0)) / perSheet) })}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <a href={href} target="_blank" rel="noreferrer" className={buttonVariants()} onClick={() => setOpen(false)}>
                {t("openLabelsPdf")}
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
