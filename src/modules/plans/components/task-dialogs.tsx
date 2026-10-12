"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Check, Undo2 } from "lucide-react";
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
import { PLAN_PHASES } from "../../../../config/app.config";
import { removeTask, saveTask, setTaskDone } from "../actions";

type Ids = { projectId: string; planId: string };
type Person = { id: string; name: string };
export type TaskForm = { id: string; phase: string; title: string; assigneeId: string | null; dueDate: string | null; notes: string | null };

export function TaskDialog({ ids, task, people, defaultPhase }: { ids: Ids; task?: TaskForm; people: Person[]; defaultPhase?: string }) {
  const t = useTranslations("plans");
  const tp = useTranslations("planPhase");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveTask, {});
  const [open, setOpen] = useActionDialog(state);
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | null | undefined) => (state.values && name in state.values ? state.values[name] : (fallback ?? ""));
  return (
    <>
      <Button size={task ? "xs" : "sm"} variant={task ? "ghost" : "default"} onClick={() => setOpen(true)}>
        {task ? tc("edit") : t("addTask")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{task ? t("editTask") : t("addTask")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            <input type="hidden" name="projectId" value={ids.projectId} />
            <input type="hidden" name="planId" value={ids.planId} />
            {task && <input type="hidden" name="id" value={task.id} />}
            <FormError message={state.error} />
            <Field id="tk-title" label={t("task")} error={err.title}>
              <Input id="tk-title" name="title" defaultValue={v("title", task?.title)} required autoFocus />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field id="tk-phase" label={t("phase")} error={err.phase}>
                <NativeSelect id="tk-phase" name="phase" defaultValue={v("phase", task?.phase ?? defaultPhase ?? "pre_production")}>
                  {PLAN_PHASES.map((p) => (
                    <option key={p} value={p}>
                      {tp(p)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="tk-who" label={t("assignee")} optional error={err.assigneeId}>
                <NativeSelect id="tk-who" name="assigneeId" defaultValue={v("assigneeId", task?.assigneeId)}>
                  <option value="">—</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="tk-due" label={t("dueDate")} optional error={err.dueDate}>
                <Input id="tk-due" name="dueDate" type="date" defaultValue={v("dueDate", task?.dueDate)} />
              </Field>
            </div>
            <Field id="tk-notes" label={t("notes")} optional error={err.notes}>
              <Textarea id="tk-notes" name="notes" rows={2} defaultValue={v("notes", task?.notes)} />
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

/** Big tick / undo button; a plain form so it works on a phone without JS. */
export function TaskDoneButton({ ids, id, done }: { ids: Ids; id: string; done: boolean }) {
  const t = useTranslations("plans");
  return (
    <form action={setTaskDone}>
      <input type="hidden" name="projectId" value={ids.projectId} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="done" value={done ? "false" : "true"} />
      <Button type="submit" size="sm" variant={done ? "ghost" : "outline"} className="h-8" aria-label={done ? t("reopen") : t("markDone")} title={done ? t("reopen") : t("markDone")}>
        {done ? <Undo2 className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
        <span className="sr-only sm:not-sr-only">{done ? t("reopen") : t("markDone")}</span>
      </Button>
    </form>
  );
}

export function RemoveTaskButton({ ids, id }: { ids: Ids; id: string }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  return (
    <form action={removeTask}>
      <input type="hidden" name="projectId" value={ids.projectId} />
      <input type="hidden" name="id" value={id} />
      <ConfirmButton confirm={t("removeTaskConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
