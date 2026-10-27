import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ActivityList } from "@/components/activity-list";
import { ConfirmButton } from "@/components/form/confirm-button";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { activityFor } from "@/lib/activity";
import { can, requireActor } from "@/lib/auth/session";
import { dateToZonedInput } from "@/lib/dates";
import { agendaActions, entryDetail, entryFormValues, entryPeopleOptions, entryProjectOptions, googleTemplateLink } from "@/modules/agenda";
import { EntryDialog } from "@/modules/agenda/components/entry-dialog";
import { entryLabel, entryWhen } from "@/modules/agenda/components/entry-list";
import { ENTRY_KINDS } from "../../../../../../config/app.config";

export const metadata: Metadata = { title: "Calendar entry" };

/** One meeting, time off or assignment: when, who, the job, and ways to put it in a calendar. */
export default async function EntryPage(props: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await props.params;
  const e = await entryDetail(id);
  if (!e) notFound();
  const t = await getTranslations("agenda");
  const tcal = await getTranslations("calendar");
  const tc = await getTranslations("common");
  const locale = (await getLocale()) === "da" ? "da-DK" : "en-GB";
  const canEdit = can(actor.role, "agenda.write");
  const [people, projects, activity] = await Promise.all([canEdit ? entryPeopleOptions() : [], canEdit ? entryProjectOptions() : [], activityFor("entry", id, 20)]);
  const label = entryLabel(e, t("off"));
  const details = [e.notes, e.projectName ? `${t("job")}: ${e.projectName}` : null, e.people.length ? e.people.map((p) => p.name).join(", ") : null].filter(Boolean).join("\n");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {label}
            <StatusPill color={ENTRY_KINDS.find((k) => k.key === e.kind)?.color ?? "gray"} className="text-sm">
              {t(`kind_${e.kind}`)}
            </StatusPill>
          </span>
        }
        subtitle={entryWhen(e, locale)}
        crumbs={[{ label: tcal("title"), href: "/calendar" }, { label }]}
        actions={
          <>
            <a href={googleTemplateLink({ title: label, allDay: e.allDay, startsAt: e.startsAt, endsAt: e.endsAt, location: e.location, details })} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("addToGoogle")}
            </a>
            <a href={`/api/agenda/${e.id}/entry.ics`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("downloadIcs")}
            </a>
            {canEdit && <EntryDialog people={people} projects={projects} actorId={actor.id} entry={entryFormValues(e, dateToZonedInput)} trigger={tc("edit")} />}
            {canEdit && (
              <form action={agendaActions.deleteEntry}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="projectId" value={e.projectId ?? ""} />
                <input type="hidden" name="returnTo" value={e.projectId ? `/projects/${e.projectId}` : "/calendar"} />
                <ConfirmButton confirm={t("deleteConfirm")} variant="ghost" size="sm" className="text-destructive">
                  {tc("delete")}
                </ConfirmButton>
              </form>
            )}
          </>
        }
      />
      <dl className="grid max-w-2xl grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{e.kind === "time_off" ? t("whoIsOff") : e.kind === "assignment" ? t("whoDoesIt") : t("whoIsInvited")}</dt>
        <dd>{e.people.length ? e.people.map((p) => p.name).join(", ") : "—"}</dd>
        {e.guests.length > 0 && (
          <>
            <dt className="text-muted-foreground">{t("guests")}</dt>
            <dd>{e.guests.join(", ")}</dd>
          </>
        )}
        {e.projectId && (
          <>
            <dt className="text-muted-foreground">{t("job")}</dt>
            <dd>
              <Link href={`/projects/${e.projectId}`} className="underline">
                {e.projectName}
              </Link>
            </dd>
          </>
        )}
        {e.location && (
          <>
            <dt className="text-muted-foreground">{t("location")}</dt>
            <dd>{e.location}</dd>
          </>
        )}
        {e.createdByName && (
          <>
            <dt className="text-muted-foreground">{t("createdBy")}</dt>
            <dd>{e.createdByName}</dd>
          </>
        )}
      </dl>
      {e.notes && <p className="max-w-2xl whitespace-pre-line text-sm">{e.notes}</p>}
      <p className="max-w-2xl text-xs text-muted-foreground">{t("calendarHint")}</p>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{tc("activity")}</h2>
        <ActivityList rows={activity} />
      </section>
    </div>
  );
}
