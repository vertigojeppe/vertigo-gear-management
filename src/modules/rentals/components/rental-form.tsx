"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/form/action-form";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Field, FormError } from "@/components/form/field";
import { CustomFieldInputs } from "@/components/form/custom-field-inputs";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CustomFieldDef } from "@/lib/custom-fields";
import type { FormState } from "@/lib/forms";
import { appConfig } from "../../../../config/app.config";
import { saveRental } from "../actions";
import type { RentalDto } from "../service";

type ClientOption = { id: string; name: string };

export function RentalForm({ rental, clients, defs }: { rental?: RentalDto; clients: ClientOption[]; defs: CustomFieldDef[] }) {
  const t = useTranslations("rentals");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveRental, {});
  const v = (name: string, fallback: string | number | null | undefined) =>
    state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback);
  const err = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="flex max-w-2xl flex-col gap-6">
      {rental && <input type="hidden" name="id" value={rental.id} />}
      <FormError message={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="clientId" label={t("client")} error={err.clientId} className="sm:col-span-2">
          <NativeSelect id="clientId" name="clientId" defaultValue={v("clientId", rental?.clientId)} required>
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="startDate" label={t("startDate")} error={err.startDate}>
          <Input id="startDate" name="startDate" type="date" defaultValue={v("startDate", rental?.startDate)} required />
        </Field>
        <Field id="endDate" label={t("endDate")} error={err.endDate}>
          <Input id="endDate" name="endDate" type="date" defaultValue={v("endDate", rental?.endDate)} required />
        </Field>
        <Field id="deposit" label={t("deposit", { currency: appConfig.currency })} optional error={err.deposit}>
          <Input id="deposit" name="deposit" type="number" step="0.01" min="0" defaultValue={v("deposit", rental?.deposit)} />
        </Field>
      </div>
      <Field id="notes" label={t("notes")} optional error={err.notes}>
        <Textarea id="notes" name="notes" rows={3} defaultValue={v("notes", rental?.notes)} />
      </Field>
      <CustomFieldInputs defs={defs} values={rental?.customFields} echoed={state.values} errors={err} />
      <div className="flex gap-2">
        <SubmitButton pendingText={tc("loading")}>{rental ? tc("save") : tc("create")}</SubmitButton>
        <Link href={rental ? `/rentals/${rental.id}` : "/rentals"} className={buttonVariants({ variant: "outline" })}>
          {tc("cancel")}
        </Link>
      </div>
    </ActionForm>
  );
}
