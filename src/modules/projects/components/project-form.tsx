"use client";

import { useActionState, useState } from "react";
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
import { dateToZonedInput } from "@/lib/dates";
import type { FormState } from "@/lib/forms";
import { PROJECT_STATUSES } from "../../../../config/app.config";
import { saveProject } from "../actions";
import { ClientDialog } from "./client-dialog";
import { linksToText } from "../schema";
import type { ProjectDto } from "../service";

type ClientOption = { id: string; name: string };

export function ProjectForm({ project, clients, defs }: { project?: ProjectDto; clients: ClientOption[]; defs: CustomFieldDef[] }) {
  const t = useTranslations("projects");
  const ts = useTranslations("projectStatus");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveProject, {});
  const v = (name: string, fallback: string | null | undefined) => (state.values && name in state.values ? state.values[name] : (fallback ?? ""));
  const err = state.fieldErrors ?? {};
  const [clientId, setClientId] = useState(v("clientId", project?.clientId));
  const [addedClients, setAddedClients] = useState<ClientOption[]>([]);
  const clientOptions = [...clients, ...addedClients.filter((a) => !clients.some((c) => c.id === a.id))];

  return (
    <ActionForm action={action} className="flex max-w-2xl flex-col gap-6">
      {project && <input type="hidden" name="id" value={project.id} />}
      <FormError message={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label={tc("name")} error={err.name} className="sm:col-span-2">
          <Input id="name" name="name" defaultValue={v("name", project?.name)} required autoFocus={!project} />
        </Field>
        <Field id="clientId" label={t("client")} optional error={err.clientId}>
          <div className="flex gap-2">
            <NativeSelect id="clientId" name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} className="min-w-0 flex-1">
              <option value="">{t("noClient")}</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
            <ClientDialog
              trigger="inline"
              onCreated={(c) => {
                setAddedClients((list) => [...list, c]);
                setClientId(c.id);
              }}
            />
          </div>
        </Field>
        <Field id="status" label={t("status")} error={err.status}>
          <NativeSelect id="status" name="status" defaultValue={v("status", project?.status ?? "quote")}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {ts(s.key)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="venueName" label={t("venueName")} optional error={err.venueName}>
          <Input id="venueName" name="venueName" defaultValue={v("venueName", project?.venueName)} />
        </Field>
        <Field id="venueAddress" label={t("venueAddress")} optional error={err.venueAddress}>
          <Input id="venueAddress" name="venueAddress" defaultValue={v("venueAddress", project?.venueAddress)} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-medium">{t("dates")}</legend>
        <p className="text-xs text-muted-foreground">{t("datesHelp")}</p>
        {/* One row per phase: first day, last day, call time. */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="prepStart" label={t("prepStart")} optional error={err.prepStart}>
            <Input id="prepStart" name="prepStart" type="date" defaultValue={v("prepStart", project?.prepStart)} />
          </Field>
          <Field id="prepEnd" label={t("prepEnd")} optional error={err.prepEnd}>
            <Input id="prepEnd" name="prepEnd" type="date" defaultValue={v("prepEnd", project?.prepEnd)} />
          </Field>
          <Field id="buildStart" label={t("buildStart")} optional error={err.buildStart} className="sm:col-start-1">
            <Input id="buildStart" name="buildStart" type="date" defaultValue={v("buildStart", project?.buildStart)} />
          </Field>
          <Field id="buildEnd" label={t("buildEnd")} optional error={err.buildEnd}>
            <Input id="buildEnd" name="buildEnd" type="date" defaultValue={v("buildEnd", project?.buildEnd)} />
          </Field>
          <Field id="buildCall" label={t("buildCall")} optional error={err.buildCall}>
            <Input id="buildCall" name="buildCall" type="time" defaultValue={v("buildCall", project?.buildCall)} />
          </Field>
          <Field id="showStart" label={t("showStart")} optional error={err.showStart} className="sm:col-start-1">
            <Input id="showStart" name="showStart" type="datetime-local" defaultValue={v("showStart", dateToZonedInput(project?.showStart))} />
          </Field>
          <Field id="showEnd" label={t("showEnd")} optional error={err.showEnd}>
            <Input id="showEnd" name="showEnd" type="datetime-local" defaultValue={v("showEnd", dateToZonedInput(project?.showEnd))} />
          </Field>
          <Field id="packStart" label={t("packStart")} optional error={err.packStart} className="sm:col-start-1">
            <Input id="packStart" name="packStart" type="date" defaultValue={v("packStart", project?.packStart)} />
          </Field>
          <Field id="packEnd" label={t("packEnd")} optional error={err.packEnd}>
            <Input id="packEnd" name="packEnd" type="date" defaultValue={v("packEnd", project?.packEnd)} />
          </Field>
          <Field id="packCall" label={t("packCall")} optional error={err.packCall}>
            <Input id="packCall" name="packCall" type="time" defaultValue={v("packCall", project?.packCall)} />
          </Field>
          <Field id="returnDate" label={t("returnDate")} optional error={err.returnDate} className="sm:col-start-1">
            <Input id="returnDate" name="returnDate" type="date" defaultValue={v("returnDate", project?.returnDate)} />
          </Field>
        </div>
      </fieldset>

      <Field id="linksText" label={t("links")} optional help={t("linksHelp")} error={err.linksText}>
        <Textarea id="linksText" name="linksText" rows={3} defaultValue={v("linksText", project ? linksToText(project.externalLinks) : "")} />
      </Field>
      <Field id="notes" label={t("notes")} optional error={err.notes}>
        <Textarea id="notes" name="notes" rows={4} defaultValue={v("notes", project?.notes)} />
      </Field>

      <CustomFieldInputs defs={defs} values={project?.customFields} echoed={state.values} errors={err} title={t("customFields")} />

      <div className="flex gap-2">
        <SubmitButton pendingText={tc("loading")}>{project ? tc("save") : tc("create")}</SubmitButton>
        <Link href={project ? `/projects/${project.id}` : "/projects"} className={buttonVariants({ variant: "outline" })}>
          {tc("cancel")}
        </Link>
      </div>
    </ActionForm>
  );
}
