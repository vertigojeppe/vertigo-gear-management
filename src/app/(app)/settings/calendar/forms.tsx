"use client";

import { ShareUrl } from "@/components/share-url";
import { useTranslations } from "next-intl";
import { ConfirmButton } from "@/components/form/confirm-button";
import { SubmitButton } from "@/components/form/submit-button";
import { rotateFeedToken, runOutboxNow } from "@/modules/calendar/actions";

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
