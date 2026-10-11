"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/form/action-form";
import { useTranslations } from "next-intl";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/forms";
import { WEBHOOK_EVENTS } from "../../../../../config/app.config";
import { runOutboxNow } from "@/modules/calendar/actions";
import { deleteWebhook, retryOutboxRow, saveWebhook } from "@/modules/settings/actions";

type WebhookRow = { id: string; name: string; url: string; secret: string; events: string[]; active: boolean };

export function WebhookDialog({ webhook, trigger }: { webhook?: WebhookRow; trigger: "new" | "edit" }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveWebhook, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | null | undefined) => (state.values && name in state.values ? state.values[name] : (fallback ?? ""));
  return (
    <>
      <Button variant={trigger === "new" ? "default" : "ghost"} size={trigger === "new" ? "default" : "xs"} onClick={() => setOpen(true)}>
        {trigger === "new" ? t("newWebhook") : tc("edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{webhook ? t("editWebhook") : t("newWebhook")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            {webhook && <input type="hidden" name="id" value={webhook.id} />}
            <FormError message={state.error} />
            <Field id="wh-name" label={t("webhookName")} error={err.name}>
              <Input id="wh-name" name="name" defaultValue={v("name", webhook?.name)} required autoFocus />
            </Field>
            <Field id="wh-url" label={t("webhookUrl")} error={err.url}>
              <Input id="wh-url" name="url" type="url" defaultValue={v("url", webhook?.url)} placeholder="https://hooks.example.com/vertigo" required />
            </Field>
            <Field id="wh-secret" label={t("webhookSecret")} help={t("webhookSecretHelp")} error={err.secret}>
              <Input id="wh-secret" name="secret" defaultValue={v("secret", webhook?.secret)} required minLength={8} />
            </Field>
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-medium">{t("webhookEvents")}</legend>
              <p className="text-xs text-muted-foreground">{t("webhookEventsHelp")}</p>
              <div className="grid grid-cols-2 gap-1 text-sm">
                {WEBHOOK_EVENTS.map((e) => (
                  <label key={e} className="flex items-center gap-2">
                    <input type="checkbox" name="events[]" value={e} className="size-4" defaultChecked={webhook?.events.includes(e)} />
                    <span className="font-mono text-xs">{e}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" className="size-4" defaultChecked={webhook?.active ?? true} />
              {t("webhookActive")}
            </label>
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

export function DeleteWebhookButton({ id }: { id: string }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  return (
    <form action={deleteWebhook}>
      <input type="hidden" name="id" value={id} />
      <ConfirmButton confirm={t("deleteWebhookConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}

export function RetryButton({ id }: { id: string }) {
  const t = useTranslations("settings");
  return (
    <form action={retryOutboxRow}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="outline" size="xs">
        {t("retry")}
      </SubmitButton>
    </form>
  );
}

export function RunNowButton() {
  const t = useTranslations("calendar");
  return (
    <form action={runOutboxNow}>
      <SubmitButton variant="outline" size="sm">
        {t("syncNow")}
      </SubmitButton>
    </form>
  );
}
