"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FormState } from "@/lib/forms";
import { convertModelTracking } from "../actions";
import type { TrackingPlan } from "../tracking-change";

/**
 * Admin: switch a model that has items between serialized and bulk. The
 * dialog spells out what will happen to which asset tags before anything
 * changes (tracking-change.ts); after the change it says what happened.
 */
export function ConvertTrackingDialog({ modelId, plan }: { modelId: string; plan: TrackingPlan }) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const tst = useTranslations("itemStatus");
  const [state, action] = useActionState<FormState<{ summary: string; newTags: string[] }>, FormData>(convertModelTracking, {});
  const [open, setOpen] = useState(false);
  const title = plan.to === "bulk" ? t("convertToBulk") : t("convertToSerialized");
  const tags = (units: { assetTag: string }[]) => units.map((u) => u.assetTag).join(", ");
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {title}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{plan.to === "bulk" ? t("convertToBulkHelp") : t("convertToSerializedHelp")}</DialogDescription>
          </DialogHeader>
          {state.ok && state.data ? (
            <div className="flex flex-col gap-3 text-sm">
              <p role="status">{state.data.summary}.</p>
              {state.data.newTags.length > 0 && <p className="text-muted-foreground">{t("convertPrintLabels", { count: state.data.newTags.length })}</p>}
              <div>
                <Button onClick={() => setOpen(false)}>{t("convertClose")}</Button>
              </div>
            </div>
          ) : "blocked" in plan ? (
            <p role="alert" className="text-sm text-destructive">
              {plan.blocked}
            </p>
          ) : (
            <ActionForm action={action} className="flex flex-col gap-3 text-sm">
              <input type="hidden" name="modelId" value={modelId} />
              <FormError message={state.error} />
              {plan.to === "bulk" ? (
                <ul className="flex list-disc flex-col gap-1 pl-5">
                  {plan.keep ? <li>{t("convertKeep", { count: plan.merge.length + 1, tag: plan.keep.assetTag })}</li> : <li>{t("convertNothingInHouse")}</li>}
                  {plan.merge.length > 0 && <li className="text-destructive">{t("convertDeleted", { count: plan.merge.length, tags: tags(plan.merge) })}</li>}
                  {plan.stay.length > 0 && <li>{t("convertStay", { count: plan.stay.length, tags: plan.stay.map((u) => `${u.assetTag} (${u.parentItemId ? t("convertInCase") : tst(u.status as "in_house").toLowerCase()})`).join(", ") })}</li>}
                </ul>
              ) : (
                <ul className="flex list-disc flex-col gap-1 pl-5">
                  {plan.split.length > 0 ? (
                    <li>{t("convertSplit", { bins: plan.split.map((b) => `${b.assetTag} (${b.quantity})`).join(", "), count: plan.newUnits })}</li>
                  ) : (
                    <li>{t("convertNothingToSplit")}</li>
                  )}
                  {plan.newUnits > 0 && <li>{t("convertPricesNote")}</li>}
                </ul>
              )}
              <p className="text-muted-foreground">{t("convertPinsNote")}</p>
              <div className="flex gap-2">
                <SubmitButton pendingText={tc("loading")} variant={plan.to === "bulk" && plan.merge.length > 0 ? "destructive" : "default"}>
                  {title}
                </SubmitButton>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  {tc("cancel")}
                </Button>
              </div>
            </ActionForm>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
