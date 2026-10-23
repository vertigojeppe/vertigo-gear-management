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
import { formatDate, formatDateTime, formatDayRange, formatMoney } from "@/lib/format";
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
import { listsForProject } from "@/modules/packing";
import { CreatePlanDialog, defaultAnchor, planSummary, planTemplateOptions } from "@/modules/plans";
import { QuoteSection, quoteFor, rateTableOptions } from "@/modules/pricing";
import { RemoveSubHireLineButton, RentInDialog, subHireLinesFor, subHireOptions } from "@/modules/subhire";
import { today } from "@/lib/dates";
import { PACKING_STATUSES, PROJECT_STATUSES } from "../../../../../config/app.config";
import { projectGearEnabled } from "@/lib/features";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage(props: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await props.params;
  const [detail, defs, models, users, packingLists, plan, planTemplates, quote, rateTables, subHire, subHireChoices] = await Promise.all([projectDetail(id), customFieldDefinitions.forEntity("project"), modelOptions(), crewOptions(), listsForProject(id), planSummary(id), planTemplateOptions(), quoteFor("project", id), rateTableOptions(), subHireLinesFor(id), subHireOptions()]);
  const tsh = await getTranslations("subhire");
  const tpack = await getTranslations("packing");
  const tplan = await getTranslations("plans");
  const tps = await getTranslations("packingStatus");
  if (!detail) notFound();
  const { project, client, crew, contacts, reservations } = detail;
  const t = await getTranslations("projects");
  const ts = await getTranslations("projectStatus");
  const tc = await getTranslations("common");
  const canEdit = can(actor.role, "projects.write");
  const isAdmin = can(actor.role, "users.manage");
  const gear = projectGearEnabled();

  const tph = await getTranslations("phase");
  const withCall = (range: string, call: string | null) => (call ? `${range} · ${t("callAt", { time: call })}` : range);
  const dates: [string, string][] = [];
  if (project.prepStart) dates.push([tph("prep"), formatDayRange(project.prepStart, project.prepEnd)]);
  if (project.buildStart) dates.push([tph("load_in"), withCall(formatDayRange(project.buildStart, project.buildEnd), project.buildCall)]);
  if (project.showStart) dates.push([t("showStart"), formatDateTime(project.showStart)]);
  if (project.showEnd) dates.push([t("showEnd"), formatDateTime(project.showEnd)]);
  if (project.packStart) dates.push([tph("load_out"), withCall(formatDayRange(project.packStart, project.packEnd), project.packCall)]);
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
        subtitle={[client?.name, project.venueName, project.reserveFrom ? (gear ? t("reserveWindow", { from: formatDate(project.reserveFrom), to: formatDate(project.reserveTo ?? project.reserveFrom) }) : null) : t("noDates")]
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

      {/* With the roomy layout (Settings › Layout), wide screens get two columns: the job on the left, the people on the right. */}
      <div className="flex flex-col gap-8 roomy:xl:grid roomy:xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] roomy:xl:items-start">
        <div className="flex min-w-0 flex-col gap-8">
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

          {/* Reserved gear, rent in and the quote: hidden until PROJECT_GEAR=on (src/lib/features.ts). */}
          {gear && (
            <>
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
                            existing={{ id: r.id, modelId: r.modelId, quantity: r.quantity, startDate: r.startDate, endDate: r.endDate, note: r.note, pricePerDay: r.pricePerDay, discountPct: r.discountPct }}
                          />
                          <RemoveReservationButton id={r.id} projectId={project.id} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {(subHire.length > 0 || subHireChoices.length > 0) && (
              <section className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-medium">
                    {tsh("title")} <span className="text-sm font-normal text-muted-foreground">({subHire.length})</span>
                  </h2>
                  {canEdit && subHireChoices.length > 0 && <RentInDialog projectId={project.id} options={subHireChoices} defaultFrom={project.reserveFrom} defaultTo={project.reserveTo} />}
                </div>
                {subHire.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{tsh("noLines")}</p>
                ) : (
                  <ul className="divide-y rounded-md border text-sm">
                    {subHire.map((l) => (
                      <li key={l.id} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                        <span className="w-10 shrink-0 font-medium">{l.quantity}×</span>
                        <span className="min-w-0 flex-1">
                          {l.label}
                          <span className="block text-xs text-muted-foreground">
                            {tsh("rentInFrom", { owner: l.ownerName })} · {formatDate(l.startDate)} – {formatDate(l.endDate)}
                            {l.costPerDay !== null ? ` · ${tsh("costShort", { amount: formatMoney(l.costPerDay) })}` : ""}
                            {l.note ? ` · ${l.note}` : ""}
                          </span>
                        </span>
                        {canEdit && (
                          <span className="flex shrink-0 items-center gap-1">
                            <RentInDialog projectId={project.id} options={subHireChoices} defaultFrom={project.reserveFrom} defaultTo={project.reserveTo} existing={l} />
                            <RemoveSubHireLineButton id={l.id} projectId={project.id} />
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {quote && <QuoteSection quote={quote} tables={rateTables} canEdit={canEdit} showGear pdfHref={`/api/projects/${project.id}/quote.pdf`} />}
            </>
          )}

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-medium">
                {t("packingLists")} <span className="text-sm font-normal text-muted-foreground">({packingLists.length})</span>
              </h2>
              {can(actor.role, "packing.write") && (
                <Link href={`/projects/${project.id}/packing/new`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  {tpack("newList")}
                </Link>
              )}
            </div>
            {packingLists.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tpack("noLists")}</p>
            ) : (
              <ul className="divide-y rounded-md border text-sm">
                {packingLists.map((pl) => (
                  <li key={pl.id}>
                    <Link href={`/projects/${project.id}/packing/${pl.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{pl.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {pl.lineCount} {tpack("lines").toLowerCase()} · {tpack("packed", { packed: pl.progress.packed, total: pl.progress.units })}
                          {pl.status === "checked_out" ? ` · ${tpack("returned", { returned: pl.progress.packed - pl.progress.toReturn, packed: pl.progress.packed })}` : ""}
                        </span>
                      </span>
                      <StatusPill color={PACKING_STATUSES.find((s) => s.key === pl.status)?.color ?? "gray"}>{tps(pl.status)}</StatusPill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-medium">{tplan("title")}</h2>
              {plan ? (
                <Link href={`/projects/${project.id}/plan`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  {tplan("openPlan")}
                </Link>
              ) : (
                can(actor.role, "plans.write") && <CreatePlanDialog projectId={project.id} templates={planTemplates.map((x) => ({ id: x.id, label: `${x.name} (${x._count.entries})` }))} defaultAnchor={defaultAnchor(project, today())} />
              )}
            </div>
            <p className="text-sm text-muted-foreground">{plan ? tplan("planSummary", { schedule: plan.schedule, done: plan.tasksDone, tasks: plan.tasks, logistics: plan.logistics }) : tplan("noPlanBody")}</p>
          </section>
        </div>
        <div className="flex min-w-0 flex-col gap-8">
          <div className="grid gap-8 md:grid-cols-2 roomy:xl:grid-cols-1">
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
      </div>
    </div>
  );
}
