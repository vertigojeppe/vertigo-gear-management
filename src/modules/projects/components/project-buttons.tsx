"use client";

import { useTranslations } from "next-intl";
import { ConfirmButton } from "@/components/form/confirm-button";
import { Button } from "@/components/ui/button";
import { deleteProject, removeReservation, setProjectStatus } from "../actions";

/** Status transition buttons. Which ones show depends on the current status. */
export function ProjectStatusButtons({ projectId, status }: { projectId: string; status: string }) {
  const t = useTranslations("projects");
  const transitions: { to: string; label: string; variant?: "default" | "outline" | "ghost"; confirm?: boolean }[] = [];
  if (status === "quote") transitions.push({ to: "confirmed", label: t("confirm"), variant: "default" });
  if (status === "confirmed") transitions.push({ to: "in_progress", label: t("start"), variant: "default" });
  if (status === "in_progress") transitions.push({ to: "done", label: t("finish"), variant: "default" });
  if (status === "confirmed" || status === "in_progress") transitions.push({ to: "quote", label: t("reopen"), variant: "ghost" });
  if (status !== "cancelled" && status !== "done") transitions.push({ to: "cancelled", label: t("cancel"), variant: "ghost", confirm: true });
  if (status === "cancelled" || status === "done") transitions.push({ to: "quote", label: t("reopen"), variant: "outline" });
  return (
    <>
      {transitions.map((tr) => (
        <form key={tr.to} action={setProjectStatus}>
          <input type="hidden" name="id" value={projectId} />
          <input type="hidden" name="status" value={tr.to} />
          {tr.confirm ? (
            <ConfirmButton confirm={`${tr.label}?`} variant={tr.variant ?? "outline"} size="sm" className={tr.to === "cancelled" ? "text-destructive" : undefined}>
              {tr.label}
            </ConfirmButton>
          ) : (
            <Button type="submit" variant={tr.variant ?? "outline"} size="sm">
              {tr.label}
            </Button>
          )}
        </form>
      ))}
    </>
  );
}

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  return (
    <form action={deleteProject}>
      <input type="hidden" name="id" value={projectId} />
      <ConfirmButton confirm={t("deleteConfirm")} variant="ghost" size="sm" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}

export function RemoveReservationButton({ id, projectId }: { id: string; projectId: string }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  return (
    <form action={removeReservation}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="projectId" value={projectId} />
      <ConfirmButton confirm={t("removeConfirm")} variant="ghost" size="xs" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
