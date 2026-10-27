"use client";

import { useActionState } from "react";
import { ShareUrl } from "@/components/share-url";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { ConfirmButton } from "@/components/form/confirm-button";
import { Field, FormError, FormSuccess } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { DecimalInput } from "@/components/form/decimal-input";
import type { FormState } from "@/lib/forms";
import { rotateFeedToken, runOutboxNow, saveCallHours, saveCalendarInvites } from "@/modules/calendar/actions";

/** On/off for sending calendar entries as invitations through Google. */
export function InvitesForm({ on }: { on: boolean }) {
  const t = useTranslations("calendar");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveCalendarInvites, {});
  return (
    <ActionForm action={action} className="flex max-w-xl flex-col gap-3">
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? t("invitesSaved") : undefined} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="invites" defaultChecked={on} className="mt-0.5 size-4" />
        <span>
          <span className="block font-medium">{t("invites")}</span>
          <span className="block text-muted-foreground">{t("invitesHelp")}</span>
        </span>
      </label>
      <div>
        <SubmitButton pendingText={tc("loading")}>{tc("save")}</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** How long build-up and pack-down events last in the calendars, from their call time. */
export function CallHoursForm({ hours }: { hours: number }) {
  const t = useTranslations("calendar");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState<{ hours: number }>, FormData>(saveCallHours, {});
  return (
    <ActionForm action={action} className="flex max-w-md flex-col gap-3">
      <FormError message={state.error} />
      <FormSuccess message={state.ok && state.data ? t("callHoursSaved", { hours: state.data.hours }) : undefined} />
      <Field id="callHours" label={t("callHours")} help={t("callHoursHelp")} error={state.fieldErrors?.callHours}>
        <DecimalInput id="callHours" name="callHours" defaultValue={state.values?.callHours ?? hours} className="w-28" />
      </Field>
      <div>
        <SubmitButton pendingText={tc("loading")}>{tc("save")}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function FeedRow({ label, scope, path }: { label: string; scope: string; path: string }) {
  const t = useTranslations("calendar");
  return (
    <li className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-32 shrink-0 font-medium">{label}</span>
      <ShareUrl path={path} />
      <form action={rotateFeedToken}>
        <input type="hidden" name="scope" value={scope} />
        <ConfirmButton confirm={t("rotateConfirm")} variant="ghost" size="xs">
          {t("rotate")}
        </ConfirmButton>
      </form>
    </li>
  );
}

export function SyncNowButton() {
  const t = useTranslations("calendar");
  return (
    <form action={runOutboxNow}>
      <SubmitButton variant="outline" size="sm">
        {t("syncNow")}
      </SubmitButton>
    </form>
  );
}
