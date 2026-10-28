"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/form/decimal-input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { deleteWish, saveWish, setWishStatus } from "../actions";
import type { WishRow } from "../queries";

type CategoryOption = { id: string; name: string; depth: number };

export function WishDialog({ wish, categories, trigger }: { wish?: WishRow; categories: CategoryOption[]; trigger: "new" | "edit" }) {
  const t = useTranslations("wishlist");
  const ti = useTranslations("inventory");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveWish, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | number | null | undefined) =>
    state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback);
  return (
    <>
      <Button variant={trigger === "new" ? "default" : "ghost"} size={trigger === "new" ? "default" : "xs"} onClick={() => setOpen(true)}>
        {trigger === "new" ? t("newWish") : tc("edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{wish ? t("editWish") : t("newWish")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            {wish && <input type="hidden" name="id" value={wish.id} />}
            <FormError message={state.error} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="w-manufacturer" label={ti("manufacturer")} optional error={err.manufacturer}>
                <Input id="w-manufacturer" name="manufacturer" defaultValue={v("manufacturer", wish?.manufacturer)} />
              </Field>
              <Field id="w-name" label={t("name")} error={err.name}>
                <Input id="w-name" name="name" defaultValue={v("name", wish?.name)} required autoFocus />
              </Field>
              <Field id="w-variant" label={ti("variant")} help={t("variantHelp")} optional error={err.variant}>
                <Input id="w-variant" name="variant" defaultValue={v("variant", wish?.variant)} />
              </Field>
              <Field id="w-category" label={ti("category")} optional error={err.categoryId}>
                <NativeSelect id="w-category" name="categoryId" defaultValue={v("categoryId", wish?.categoryId)}>
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {"  ".repeat(c.depth)}
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="w-quantity" label={t("quantity")} error={err.quantity}>
                <Input id="w-quantity" name="quantity" type="number" min="1" step="1" defaultValue={v("quantity", wish?.quantity ?? 1)} />
              </Field>
              <Field id="w-price" label={t("price")} help={t("priceHelp")} optional error={err.price}>
                <DecimalInput id="w-price" name="price" defaultValue={v("price", wish?.price)} />
              </Field>
              <Field id="w-dayprice" label={t("rentalDayPrice")} help={t("rentalDayPriceHelp")} optional error={err.rentalDayPrice}>
                <DecimalInput id="w-dayprice" name="rentalDayPrice" defaultValue={v("rentalDayPrice", wish?.rentalDayPrice)} />
              </Field>
              <Field id="w-link" label={t("link")} optional error={err.link}>
                <Input id="w-link" name="link" type="url" placeholder="https://" defaultValue={v("link", wish?.link)} />
              </Field>
            </div>
            <Field id="w-notes" label={t("notes")} optional error={err.notes}>
              <Textarea id="w-notes" name="notes" rows={3} defaultValue={v("notes", wish?.notes)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <SubmitButton pendingText={tc("loading")}>{tc("save")}</SubmitButton>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "Bought" for things that do not become a model (reference material, consumables); "Reopen" undoes it. */
export function WishStatusButton({ id, status }: { id: string; status: string }) {
  const t = useTranslations("wishlist");
  const [state, action] = useActionState<FormState, FormData>(setWishStatus, {});
  const next = status === "open" ? "bought" : "open";
  return (
    <ActionForm action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
      <SubmitButton variant="ghost" size="xs">
        {next === "bought" ? t("markBought") : t("reopen")}
      </SubmitButton>
    </ActionForm>
  );
}

export function DeleteWishButton({ id }: { id: string }) {
  const t = useTranslations("wishlist");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(deleteWish, {});
  return (
    <ActionForm action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
      <ConfirmButton confirm={t("deleteConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </ActionForm>
  );
}
