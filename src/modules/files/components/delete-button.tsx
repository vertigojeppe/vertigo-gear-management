"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { ConfirmButton } from "@/components/form/confirm-button";
import { deleteAttachment } from "../actions";

export function DeleteAttachmentButton({ id, returnTo }: { id: string; returnTo: string }) {
  const t = useTranslations("attachments");
  return (
    <form action={deleteAttachment}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <ConfirmButton confirm={t("deleteConfirm")} variant="outline" size="icon-xs" aria-label={t("deleteConfirm")}>
        <X />
      </ConfirmButton>
    </form>
  );
}
