import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StatusPill } from "@/components/status-pill";
import { formatDate, formatDateTime } from "@/lib/format";
import type { MyDay } from "../my-day";
import { TaskDoneButton } from "./task-dialogs";

/**
 * "My day" on the dashboard: today's and tomorrow's schedule on my
 * projects, my open tasks, and the projects I am booked on this week with
 * their call times. Server component; the page passes `myDay(actor.id)`.
 */
export async function MyDaySection({ data, canEditPlans }: { data: MyDay; canEditPlans: boolean }) {
  const t = await getTranslations("myDay");
  const tp = await getTranslations("planPhase");
  const todayEntries = data.schedule.filter((e) => e.day === data.today);
  const tomorrowEntries = data.schedule.filter((e) => e.day !== data.today);
  const nothing = data.schedule.length === 0 && data.tasks.length === 0 && data.projects.length === 0;

  const entryList = (rows: typeof data.schedule) => (
    <ul className="divide-y rounded-md border text-sm">
      {rows.map((e) => (
        <li key={e.id}>
          <Link href={e.href ?? `/projects/${e.projectId}/plan?day=${e.day}`} className="flex items-start gap-3 px-3 py-1.5 hover:bg-muted/50">
            <span className="w-24 shrink-0 font-mono text-xs leading-5">
              {e.time || t("allDay")}
              {e.endTime ? `–${e.endTime}` : ""}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">
                {e.title}
                {e.mine && <span className="ml-1 text-xs text-muted-foreground">· {t("youAreResponsible")}</span>}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {e.projectName}
                {e.location ? ` · ${e.location}` : ""}
                {!e.mine && e.responsibleName ? ` · ${e.responsibleName}` : ""}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">{t("title")}</h2>
        <span className="text-xs text-muted-foreground">{formatDate(data.today)}</span>
      </div>
      {nothing ? (
        <p className="text-sm text-muted-foreground">{t("nothing")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">{t("today")}</h3>
            {todayEntries.length === 0 ? <p className="text-sm text-muted-foreground">{t("todayEmpty")}</p> : entryList(todayEntries)}
            {tomorrowEntries.length > 0 && (
              <>
                <h3 className="text-sm font-medium">{t("tomorrow")}</h3>
                {entryList(tomorrowEntries)}
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">
              {t("tasks")} <span className="font-normal text-muted-foreground">({data.tasks.length})</span>
            </h3>
            {data.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("tasksEmpty")}</p>
            ) : (
              <ul className="divide-y rounded-md border text-sm">
                {data.tasks.slice(0, 12).map((task) => (
                  <li key={task.id} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="min-w-0 flex-1">
                      <Link href={`/projects/${task.projectId}/plan`} className="block truncate hover:underline">
                        {task.title}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">
                        {task.projectName} · {tp(task.phase)}
                        {task.dueDate ? ` · ${formatDate(task.dueDate)}` : ""}
                      </span>
                    </span>
                    {task.overdue ? <StatusPill color="red">{t("overdue")}</StatusPill> : task.dueSoon ? <StatusPill color="amber">{t("dueSoon")}</StatusPill> : null}
                    {canEditPlans && <TaskDoneButton ids={{ projectId: task.projectId, planId: task.planId }} id={task.id} done={false} />}
                  </li>
                ))}
                {data.tasks.length > 12 && <li className="px-3 py-1.5 text-xs text-muted-foreground">{t("moreTasks", { count: data.tasks.length - 12 })}</li>}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">{t("thisWeek")}</h3>
            {data.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("thisWeekEmpty")}</p>
            ) : (
              <ul className="divide-y rounded-md border text-sm">
                {data.projects.map((p) => (
                  <li key={p.id} className="flex flex-col gap-1 px-3 py-1.5">
                    <Link href={`/projects/${p.id}`} className="truncate font-medium hover:underline">
                      {p.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {p.callTime ? t("callTime", { when: formatDateTime(p.callTime) }) : p.reserveFrom ? `${formatDate(p.reserveFrom)} – ${formatDate(p.reserveTo ?? p.reserveFrom)}` : ""}
                      {p.role ? ` · ${p.role}` : ""}
                      {p.venueName ? ` · ${p.venueName}` : ""}
                    </span>
                    {p.planId && (
                      <span className="flex gap-3 text-xs">
                        <Link href={`/projects/${p.id}/plan`} className="underline">
                          {t("openPlan")}
                        </Link>
                        <a href={`/api/plans/${p.planId}/plan.pdf?me=1`} target="_blank" rel="noreferrer" className="underline">
                          {t("myPlanPdf")}
                        </a>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
