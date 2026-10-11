"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/form/action-form";
import { useTranslations } from "next-intl";
import { SubmitButton } from "@/components/form/submit-button";
import type { FormState } from "@/lib/forms";
import { addItemToKit } from "../actions";

export function AddToKitButton({ kitId, itemId }: { kitId: string; itemId: string }) {
  const t = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(addItemToKit, {});
  return (
    <ActionForm action={action} className="flex items-center gap-2">
      <input type="hidden" name="kitId" value={kitId} />
      <input type="hidden" name="itemId" value={itemId} />
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
      <SubmitButton size="xs" variant="outline">
        {t("add")}
      </SubmitButton>
    </ActionForm>
  );
}
