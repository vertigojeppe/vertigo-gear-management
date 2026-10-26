"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { saveEntry } from "../actions";
import type { EntryFormValues } from "../logic";
import { ENTRY_KINDS, type EntryKind } from "../../../../config/app.config";

type Option = { id: string; name: string };

/**
 * New or changed calendar entry. Time off: whole days for one person.
 * Meetings and assignments: a day with from–to times (or whole days), the
 * colleagues on it, guests by email, an optional job, place and notes.
 */
export function EntryDialog({
  people,
  projects,
  actorId,
  entry,
  defaults = {},
  trigger,
  triggerVariant = "outline",
}: {
  people: Option[];
  projects: Option[];
  actorId: string;
  entry?: EntryFormValues;
  defaults?: { kind?: EntryKind; projectId?: string; fromDate?: string };
  trigger: string;
  triggerVariant?: "outline" | "default" | "ghost";
}) {
  const t = useTranslations("agenda");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState<{ id: string }>, FormData>(saveEntry, {});
  const [open, setOpen] = useActionDialog(state);
  const initialKind = entry?.kind ?? defaults.kind ?? "meeting";
  const [kind, setKind] = useState<EntryKind>(initialKind);
  const [allDay, setAllDay] = useState(entry?.allDay ?? false);
  // Every opening starts from the entry (or a new meeting), not from what the last one was.
  const openFresh = () => {
    setKind(initialKind);
    setAllDay(entry?.allDay ?? false);
    setOpen(true);
  };
  const err = state.fieldErrors ?? {};
  const v = (field: keyof EntryFormValues, fallback: string) => (state.values && field in state.values ? state.values[field] : fallback);
  const wholeDays = kind === "time_off" || allDay;
  // New meetings and assignments start with the person making them ticked; the form keeps what was ticked after an error.
  const picked = new Set(entry?.people ?? [actorId]);

  return (
    <>
      <Button variant={triggerVariant} size="sm" onClick={openFresh}>
        {trigger}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{entry ? t("edit") : t("new")}</DialogTitle>
            <DialogDescription>{t(`help_${kind}`)}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            {entry?.id && <input type="hidden" name="id" value={entry.id} />}
            <FormError message={state.error} />
            <Field id="en-kind" label={t("kind")} error={err.kind}>
              <NativeSelect id="en-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as EntryKind)}>
                {ENTRY_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {t(`kind_${k.key}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="en-title" label={t("title")} optional={kind === "time_off"} help={kind === "time_off" ? t("titleOffHelp") : undefined} error={err.title}>
              <Input id="en-title" name="title" defaultValue={v("title", entry?.title ?? "")} required={kind !== "time_off"} autoFocus />
            </Field>

            {kind === "time_off" ? (
              <Field id="en-person" label={t("whoIsOff")} error={err.people}>
                <NativeSelect id="en-person" name="people" defaultValue={v("people" as keyof EntryFormValues, entry?.people[0] ?? actorId)}>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="allDay" className="size-4" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
                {t("allDay")}
              </label>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="en-from" label={wholeDays ? t("firstDay") : t("date")} error={err.fromDate}>
                <Input id="en-from" name="fromDate" type="date" defaultValue={v("fromDate", entry?.fromDate ?? defaults.fromDate ?? "")} required />
              </Field>
              {wholeDays ? (
                <Field id="en-to" label={t("lastDay")} optional error={err.toDate}>
                  <Input id="en-to" name="toDate" type="date" defaultValue={v("toDate", entry?.toDate ?? "")} />
                </Field>
              ) : (
                <>
                  <Field id="en-start" label={t("from")} error={err.startTime}>
                    <Input id="en-start" name="startTime" type="time" defaultValue={v("startTime", entry?.startTime ?? "")} required />
                  </Field>
                  <Field id="en-end" label={t("to")} optional error={err.endTime}>
                    <Input id="en-end" name="endTime" type="time" defaultValue={v("endTime", entry?.endTime ?? "")} />
                  </Field>
                </>
              )}
            </div>

            {kind !== "time_off" && (
              <>
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1 text-sm font-medium">{kind === "assignment" ? t("whoDoesIt") : t("whoIsInvited")}</legend>
                  <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
                    {people.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="people" value={p.id} defaultChecked={picked.has(p.id)} className="size-4" />
                        {p.name}
                      </label>
                    ))}
                  </div>
                  {err.people && <p className="text-sm text-destructive">{err.people}</p>}
                </fieldset>
                <Field id="en-guests" label={t("guests")} optional help={t("guestsHelp")} error={err.guestsText}>
                  <Input id="en-guests" name="guestsText" defaultValue={v("guestsText", entry?.guestsText ?? "")} placeholder="name@example.com" />
                </Field>
                <Field id="en-project" label={t("job")} optional error={err.projectId}>
                  <NativeSelect id="en-project" name="projectId" defaultValue={v("projectId", entry?.projectId ?? defaults.projectId ?? "")}>
                    <option value="">{t("noJob")}</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field id="en-location" label={t("location")} optional error={err.location}>
                  <Input id="en-location" name="location" defaultValue={v("location", entry?.location ?? "")} />
                </Field>
              </>
            )}
            <Field id="en-notes" label={t("notes")} optional error={err.notes}>
              <Textarea id="en-notes" name="notes" rows={3} defaultValue={v("notes", entry?.notes ?? "")} />
            </Field>
            <div className="flex gap-2">
              <SubmitButton pendingText={tc("loading")}>{tc("save")}</SubmitButton>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
