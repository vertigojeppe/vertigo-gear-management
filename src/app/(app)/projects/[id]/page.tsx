import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActivityList } from "@/components/activity-list";
import { CustomFieldValuesList } from "@/components/form/custom-field-inputs";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { can, requireActor } from "@/lib/auth/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { modelOptions } from "@/modules/inventory";
import {
  ContactDialog,
  CrewDialog,
  DeleteProjectButton,
  ProjectStatusButtons,
  RemoveContactButton,
  RemoveCrewButton,
  RemoveReservationButton,
  ReserveDialog,
  crewOptions,
  projectDetail,
} from "@/modules/projects";
import { customFieldDefinitions } from "@/modules/settings";
import { PROJECT_STATUSES } from "../../../../../config/app.config";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage(props: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await props.params;
  const [detail, defs, models, users] = await Promise.all([projectDetail(id), customFieldDefinitions.forEntity("project"), modelOptions(), crewOptions()]);
  if (!detail) notFound();
  const { project, client, crew, contacts, reservations } = detail;
  const t = await getTranslations("projects");
  const ts = await getTranslations("projectStatus");
  const tc = await getTranslations("common");
  const canEdit = can(actor.role, "projects.write");
  const isAdmin = can(actor.role, "users.manage");

  const dates: [string, string][] = [];
  if (project.prepStart) dates.push([t("prepStart"), formatDate(project.prepStart)]);
  if (project.loadIn) dates.push([t("loadIn"), formatDateTime(project.loadIn)]);
  if (project.showStart) dates.push([t("showStart"), formatDateTime(project.showStart)]);
  if (project.showEnd) dates.push([t("showEnd"), formatDateTime(project.showEnd)]);
  if (project.loadOut) dates.push([t("loadOut"), formatDateTime(project.loadOut)]);
  if (project.returnDate) dates.push([t("returnDate"), formatDate(project.returnDate)]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {project.name}
            <StatusPill color={PROJECT_STATUSES.find((s) => s.key === project.status)?.color ?? "gray"} className="text-sm">
              {ts(project.status)}
            </StatusPill>
          </span>
        }
        subtitle={[client?.name, project.venueName, project.reserveFrom ? t("reserveWindow", { from: formatDate(project.reserveFrom), to: formatDate(project.reserveTo ?? project.reserveFrom) }) : t("noDates")]
          .filter(Boolean)
          .join(" · ")}
        crumbs={[{ label: t("title"), href: "/projects" }, { label: project.name }]}
        actions={
          canEdit && (
            <>
              <ProjectStatusButtons projectId={project.id} status={project.status} />
              <Link href={`/projects/${project.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                {tc("edit")}
              </Link>
              {isAdmin && <DeleteProjectButton projectId={project.id} />}
            </>
          )
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{t("dates")}</h2>
          {dates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noDates")}</p>
          ) : (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
              {dates.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
        <section className="flex flex-col gap-2 text-sm">
          {(project.venueName || project.venueAddress) && (
            <div>
              <h2 className="text-sm font-medium">{t("venue")}</h2>
              <p>{[project.venueName, project.venueAddress].filter(Boolean).join(", ")}</p>
            </div>
          )}
          {client && (
            <div>
              <h2 className="text-sm font-medium">{t("client")}</h2>
              <p>
                {client.name}
                {client.contactName ? ` · ${client.contactName}` : ""}
                {client.phone ? ` · ${client.phone}` : ""}
                {client.email ? ` · ${client.email}` : ""}
              </p>
            </div>
          )}
          {project.externalLinks.length > 0 && (
            <ul className="flex flex-wrap gap-3">
              {project.externalLinks.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noreferrer" className="underline">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">{t("itemsOnSite", { count: detail.itemsOnSite })}</p>
          <CustomFieldValuesList defs={defs} values={project.customFields} />
          {project.notes && <p className="whitespace-pre-line text-muted-foreground">{project.notes}</p>}
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">
            {t("reservations")} <span className="text-sm font-normal text-muted-foreground">({reservations.length})</span>
          </h2>
          {canEdit && <ReserveDialog projectId={project.id} models={models} defaultFrom={project.reserveFrom} defaultTo={project.reserveTo} />}
        </div>
        {reservations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noReservations")}</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {reservations.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="w-10 shrink-0 font-medium">{r.quantity}×</span>
                <span className="min-w-0 flex-1">
                  <Link href={`/inventory/models/${r.modelId}`} className="hover:underline">
                    {r.modelLabel}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    {r.note ? ` · ${r.note}` : ""}
                    {r.itemTag ? ` · ${r.itemTag}` : ""}
                  </span>
                </span>
                {r.shortfall > 0 ? (
                  <StatusPill color="red" className="shrink-0" title={r.conflicts.map((c) => `${c.quantity}× ${c.holderName} (${c.startDate} – ${c.endDate})`).join("\n")}>
                    {t("overbooked")} · {t("shortfall", { count: r.shortfall })}
                  </StatusPill>
                ) : (
                  <StatusPill color="green" className="shrink-0">
                    {t("ok")} · {t("available", { count: r.available })}
                  </StatusPill>
                )}
                {canEdit && (
                  <span className="flex shrink-0 items-center gap-1">
                    <ReserveDialog
                      projectId={project.id}
                      models={models}
                      defaultFrom={project.reserveFrom}
                      defaultTo={project.reserveTo}
                      existing={{ id: r.id, modelId: r.modelId, quantity: r.quantity, startDate: r.startDate, endDate: r.endDate, note: r.note }}
                    />
                    <RemoveReservationButton id={r.id} projectId={project.id} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">
              {t("crew")} <span className="text-sm font-normal text-muted-foreground">({crew.length})</span>
            </h2>
            {canEdit && <CrewDialog projectId={project.id} users={users} />}
          </div>
          {crew.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noCrew")}</p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {crew.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {c.name}
                      {c.role ? <span className="font-normal text-muted-foreground"> · {c.role}</span> : null}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {[c.phone, c.email, c.callTime ? `${t("callTime")} ${formatDateTime(c.callTime)}` : null, c.notes].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {canEdit && <RemoveCrewButton id={c.id} projectId={project.id} />}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">
              {t("contacts")} <span className="text-sm font-normal text-muted-foreground">({contacts.length})</span>
            </h2>
            {canEdit && <ContactDialog projectId={project.id} />}
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noContacts")}</p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {c.name}
                      {c.role ? <span className="font-normal text-muted-foreground"> · {c.role}</span> : null}
                    </span>
                    <span className="block text-xs text-muted-foreground">{[c.phone, c.email, c.notes].filter(Boolean).join(" · ")}</span>
                  </span>
                  {canEdit && <RemoveContactButton id={c.id} projectId={project.id} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{tc("activity")}</h2>
        <ActivityList rows={detail.activity} />
      </section>
    </div>
  );
}
