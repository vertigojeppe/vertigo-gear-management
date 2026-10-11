"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/forms";
import { ATTACHMENT_KINDS } from "../../../../config/app.config";
import { uploadAttachment } from "../actions";

export function UploadForm({ entityType, entityId, returnTo }: { entityType: string; entityId: string; returnTo: string }) {
  const t = useTranslations("attachments");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(uploadAttachment, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <NativeSelect name="kind" defaultValue="photo" aria-label={t("kind")} className="sm:w-32">
        {ATTACHMENT_KINDS.map((k) => (
          <option key={k} value={k}>
            {t(k)}
          </option>
        ))}
      </NativeSelect>
      <Input type="file" name="file" aria-label={t("file")} required className="sm:flex-1" />
      <SubmitButton variant="outline" pendingText={tc("loading")}>
        {t("upload")}
      </SubmitButton>
      <FormError message={state.error ?? state.fieldErrors?.file} />
    </form>
  );
}
