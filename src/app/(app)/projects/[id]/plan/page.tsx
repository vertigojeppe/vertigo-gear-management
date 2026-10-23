import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { can, requireActor } from "@/lib/auth/session";
import { dateFromString, dateToZonedInput, today } from "@/lib/dates";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import { Paperclip } from "lucide-react";
import { shareLinks } from "@/modules/packing";
import {
  ApplyPlanTemplateDialog,
  CreatePlanDialog,
  DeletePlanButton,
  DocumentUploader,
  LogisticsDialog,
  PlanNotesForm,
  PlanShareControls,
  RemoveLogisticsButton,
  RemoveScheduleEntryButton,
  RemoveTaskButton,
  SavePlanAsTemplateDialog,
  ScheduleEntryDialog,
  TaskDialog,
  TaskDoneButton,
  datesLine,
  defaultAnchor,
  documentsForPlan,
  planDetail,
  planTemplateOptions,
} from "@/modules/plans";
import { crewOptions, projects } from "@/modules/projects";
import { PACKING_STATUSES, PLAN_PHASES } from "../../../../../../config/app.config";

export const metadata: Metadata = { title: "Production plan" };

function weekday(day: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(dateFromString(day));
}

export default async function PlanPage(props: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await props.params;
  const project = await projects.get(id);
  if (!project) notFound();
  const t = await getTranslations("plans");
  const tp = await getTranslations("projects");
  const tph = await getTranslations("planPhase");
  const tphase = await getTranslations("phase");
  const tk = await getTranslations("logisticsKind");
  const tps = await getTranslations("packingStatus");
  const tpack = await getTranslations("packing");
  const canEdit = can(actor.role, "plans.write");
  const anchor = defaultAnchor(project, today());
  const [detail, templates, people] = await Promise.all([planDetail(id), planTemplateOptions(), crewOptions()]);
  const templateOptions = templates.map((x) => ({ id: x.id, label: `${x.name} (${x._count.entries})` }));
  const crumbs = [{ label: tp("title"), href: "/projects" }, { label: project.name, href: `/projects/${id}` }, { label: t("title") }];

  if (!detail) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={`${t("title")} · ${project.name}`} crumbs={crumbs} />
        <EmptyState title={t("noPlan")} body={t("noPlanBody")} action={canEdit && <CreatePlanDialog projectId={id} templates={templateOptions} defaultAnchor={anchor} />} />
      </div>
    );
  }

  const { plan, days, tasks, taskProgress, logistics, crew, contacts, packingLists } = detail;
  const ids = { projectId: id, planId: plan.id };
  const [share, docs] = await Promise.all([shareLinks.current("plan", plan.id), documentsForPlan(plan.id)]);
  const docsFor = (key: "scheduleEntryId" | "taskId", value: string) => docs.filter((d) => d[key] === value);
  const clip = (list: typeof docs) =>
    list.length > 0 ? (
      <span className="flex flex-wrap gap-1">
        {list.map((d) => (
          <Link key={d.id} href={`/projects/${id}/plan/documents/${d.id}`} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted" title={d.name}>
            <Paperclip className="size-3" aria-hidden />
            <span className="max-w-40 truncate">{d.name}</span>
          </Link>
        ))}
      </span>
    ) : null;
  const todayStr = today();

  return (
    <div data-wide className="flex flex-col gap-8">
      <PageHeader
        title={`${t("title")} · ${project.name}`}
        subtitle={datesLine(project, { build: tphase("load_in"), show: tp("showStart"), pack: tphase("load_out"), call: (time) => tp("callAt", { time }) }) || tp("noDates")}
        crumbs={crumbs}
        actions={
          <>
            <a href={`/api/plans/${plan.id}/plan.pdf`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("fullPdf")}
            </a>
            {canEdit && templateOptions.length > 0 && <ApplyPlanTemplateDialog ids={ids} templates={templateOptions} defaultAnchor={anchor} />}
            {canEdit && <SavePlanAsTemplateDialog ids={ids} defaultName={project.name} defaultAnchor={anchor} />}
            {canEdit && <DeletePlanButton ids={ids} />}
          </>
        }
      />

      {/* With the roomy layout (Settings › Layout), schedule and tasks sit side by side on wide screens. */}
      <div className="flex flex-col gap-8 roomy:xl:grid roomy:xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] roomy:xl:items-start">
        {/* Schedule */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">{t("schedule")}</h2>
            {canEdit && <ScheduleEntryDialog ids={ids} people={people} defaultDay={days[0]?.day ?? anchor} />}
          </div>
          {days.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noSchedule")}</p>
          ) : (
            days.map((d) => (
              <div key={d.day} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className={`text-sm font-medium ${d.day === todayStr ? "text-green-700 dark:text-green-300" : "text-muted-foreground"}`}>
                    {weekday(d.day)} {formatDate(d.day)}
                    {d.day === todayStr ? ` · ${t("today")}` : ""}
                  </h3>
                  <a href={`/api/plans/${plan.id}/plan.pdf?day=${d.day}`} target="_blank" rel="noreferrer" className="text-xs underline">
                    {t("daySheet")}
                  </a>
                </div>
                <ul className="divide-y rounded-md border text-sm">
                  {d.entries.map((e) => (
                    <li key={e.id} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                      <span className="w-28 shrink-0 font-mono text-xs">
                        {e.time}
                        {e.endTime ? `–${e.endTime}` : ""}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{e.title}</span>
                        <span className="block text-xs text-muted-foreground">{[e.location, e.responsibleName, e.notes].filter(Boolean).join(" · ")}</span>
                        {clip(docsFor("scheduleEntryId", e.id))}
                      </span>
                      {canEdit && (
                        <span className="flex shrink-0 items-center gap-1">
                          <ScheduleEntryDialog ids={ids} people={people} defaultDay={d.day} entry={{ id: e.id, day: e.day, time: e.time, durationMin: e.durationMin, title: e.title, location: e.location, responsibleId: e.responsibleId, notes: e.notes }} />
                          <RemoveScheduleEntryButton ids={ids} id={e.id} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        {/* Tasks */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">
              {t("tasks")} <span className="text-sm font-normal text-muted-foreground">{t("tasksProgress", { done: taskProgress.done, total: taskProgress.total })}</span>
            </h2>
            {canEdit && <TaskDialog ids={ids} people={people} />}
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noTasks")}</p>
          ) : (
            PLAN_PHASES.map((phase) => {
              const list = tasks.filter((x) => x.phase === phase);
              if (list.length === 0) return null;
              return (
                <div key={phase} className="flex flex-col gap-1">
                  <h3 className="text-sm font-medium text-muted-foreground">{tph(phase)}</h3>
                  <ul className="divide-y rounded-md border text-sm">
                    {list.map((x) => {
                      const overdue = !x.done && x.dueDate !== null && x.dueDate < todayStr;
                      return (
                        <li key={x.id} className="flex items-center gap-3 px-3 py-2">
                          {canEdit ? <TaskDoneButton ids={ids} id={x.id} done={x.done} /> : <span className="text-xs">{x.done ? "✓" : "○"}</span>}
                          <span className="min-w-0 flex-1">
                            <span className={`block ${x.done ? "text-muted-foreground line-through" : "font-medium"}`}>{x.title}</span>
                            <span className="block text-xs text-muted-foreground">
                              {[x.assigneeName, x.dueDate ? formatDate(x.dueDate) : null, x.notes].filter(Boolean).join(" · ")}
                              {overdue ? <span className="ml-1 text-destructive">{t("overdue")}</span> : null}
                            </span>
                            {clip(docsFor("taskId", x.id))}
                          </span>
                          {canEdit && (
                            <span className="flex shrink-0 items-center gap-1">
                              <TaskDialog ids={ids} people={people} task={{ id: x.id, phase: x.phase, title: x.title, assigneeId: x.assigneeId, dueDate: x.dueDate, notes: x.notes }} />
                              <RemoveTaskButton ids={ids} id={x.id} />
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </section>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Crew & contacts (from the project) */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">{t("crewAndContacts")}</h2>
            <Link href={`/projects/${id}`} className="text-xs underline">
              {t("editOnProject")}
            </Link>
          </div>
          {crew.length === 0 && contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noCrew")}</p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {crew.map((c) => (
                <li key={c.id} className="px-3 py-2">
                  <span className="block font-medium">
                    {c.name}
                    {c.role ? <span className="font-normal text-muted-foreground"> · {c.role}</span> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{[c.phone, c.callTime ? `${t("callTime")} ${formatDateTime(c.callTime)}` : null, c.notes].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
              {contacts.map((c) => (
                <li key={c.id} className="px-3 py-2">
                  <span className="block font-medium">
                    {c.name}
                    {c.role ? <span className="font-normal text-muted-foreground"> · {c.role}</span> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{[c.phone, c.email, c.notes].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Logistics */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">{t("logistics")}</h2>
            {canEdit && <LogisticsDialog ids={ids} />}
          </div>
          {logistics.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noLogistics")}</p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {logistics.map((l) => (
                <li key={l.id} className="flex items-start gap-3 px-3 py-2">
                  <StatusPill color="gray" className="mt-0.5 shrink-0">
                    {tk(l.kind)}
                  </StatusPill>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{l.title}</span>
                    <span className="block whitespace-pre-line text-xs text-muted-foreground">{[l.at ? formatDateTime(l.at) : null, l.details].filter(Boolean).join(" · ")}</span>
                  </span>
                  {canEdit && (
                    <span className="flex shrink-0 items-center gap-1">
                      <LogisticsDialog ids={ids} entry={{ id: l.id, kind: l.kind, title: l.title, details: l.details, at: dateToZonedInput(l.at) }} />
                      <RemoveLogisticsButton ids={ids} id={l.id} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Documents */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          {t("documents")} <span className="text-sm font-normal text-muted-foreground">({docs.length})</span>
        </h2>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noDocuments")}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 roomy:2xl:grid-cols-4">
            {docs.map((d) => (
              <li key={d.id}>
                <Link href={`/projects/${id}/plan/documents/${d.id}`} className="flex gap-3 rounded-md border p-2 hover:bg-muted/50">
                  {d.latest.thumbUrl || d.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.latest.thumbUrl ?? d.previewUrl ?? ""} alt="" className="size-16 shrink-0 rounded object-cover" />
                  ) : (
                    <span className="flex size-16 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium uppercase text-muted-foreground">{d.latest.name.split(".").pop()?.slice(0, 5)}</span>
                  )}
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate font-medium">{d.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t(`kind_doc_${d.kind}` as "kind_doc_image")} · {t("version")} {d.latest.version} · {formatBytes(d.latest.size)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {d.latest.uploaderName ?? ""} · {formatDate(d.latest.createdAt)}
                      {d.pinnedTo ? ` · 📎 ${d.pinnedTo}` : ""}
                      {d.latest.markups.some((m) => m.shapes.length > 0) ? ` · ${t("hasMarkup")}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {canEdit && <DocumentUploader planId={plan.id} />}
        {canEdit && <p className="text-xs text-muted-foreground">{t("documentsHelp")}</p>}
      </section>

      {/* Packing lists */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("packingLists")}</h2>
        {packingLists.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noPackingLists")}</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {packingLists.map((pl) => (
              <li key={pl.id}>
                <Link href={`/projects/${id}/packing/${pl.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{pl.name}</span>
                    <span className="block text-xs text-muted-foreground">{tpack("packed", { packed: pl.progress.packed, total: pl.progress.units })}</span>
                  </span>
                  <StatusPill color={PACKING_STATUSES.find((s) => s.key === pl.status)?.color ?? "gray"}>{tps(pl.status as "draft")}</StatusPill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit ? <PlanNotesForm ids={ids} notes={plan.notes} /> : plan.notes ? <p className="whitespace-pre-line text-sm text-muted-foreground">{plan.notes}</p> : null}

      {can(actor.role, "share.create") && <PlanShareControls ids={ids} path={share ? `/share/plan/${share.token}` : null} />}
    </div>
  );
}
