"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { ConfirmButton } from "@/components/form/confirm-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { removeScheduleEntry, saveScheduleEntry } from "../actions";

type Ids = { projectId: string; planId: string };
type Person = { id: string; name: string };
export type ScheduleEntryForm = { id: string; day: string; time: string; durationMin: number | null; title: string; location: string | null; responsibleId: string | null; notes: string | null };

export function ScheduleEntryDialog({ ids, entry, people, defaultDay }: { ids: Ids; entry?: ScheduleEntryForm; people: Person[]; defaultDay: string }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveScheduleEntry, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | number | null | undefined) => (state.values && name in state.values ? state.values[name] : fallback === null || fallback === undefined ? "" : String(fallback));
  return (
    <>
      <Button size={entry ? "xs" : "sm"} variant={entry ? "ghost" : "default"} onClick={() => setOpen(true)}>
        {entry ? tc("edit") : t("addEntry")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{entry ? t("editEntry") : t("addEntry")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="projectId" value={ids.projectId} />
            <input type="hidden" name="planId" value={ids.planId} />
            {entry && <input type="hidden" name="id" value={entry.id} />}
            <FormError message={state.error} />
            <Field id="se-title" label={t("what")} error={err.title}>
              <Input id="se-title" name="title" defaultValue={v("title", entry?.title)} required autoFocus />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field id="se-date" label={t("day")} error={err.date}>
                <Input id="se-date" name="date" type="date" defaultValue={v("date", entry?.day ?? defaultDay)} required />
              </Field>
              <Field id="se-time" label={t("time")} error={err.time}>
                <Input id="se-time" name="time" type="time" defaultValue={v("time", entry?.time ?? "09:00")} required />
              </Field>
              <Field id="se-dur" label={t("durationMin")} optional error={err.durationMin}>
                <Input id="se-dur" name="durationMin" type="number" min="0" step="15" defaultValue={v("durationMin", entry?.durationMin)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="se-loc" label={t("where")} optional error={err.location}>
                <Input id="se-loc" name="location" defaultValue={v("location", entry?.location)} />
              </Field>
              <Field id="se-who" label={t("responsible")} optional error={err.responsibleId}>
                <NativeSelect id="se-who" name="responsibleId" defaultValue={v("responsibleId", entry?.responsibleId)}>
                  <option value="">—</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field id="se-notes" label={t("notes")} optional error={err.notes}>
              <Textarea id="se-notes" name="notes" rows={2} defaultValue={v("notes", entry?.notes)} />
            </Field>
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

export function RemoveScheduleEntryButton({ ids, id }: { ids: Ids; id: string }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  return (
    <form action={removeScheduleEntry}>
      <input type="hidden" name="projectId" value={ids.projectId} />
      <input type="hidden" name="id" value={id} />
      <ConfirmButton confirm={t("removeEntryConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
