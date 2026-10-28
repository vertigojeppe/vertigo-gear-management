import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { dateFromString } from "@/lib/dates";
import { formatDate, formatDateTime } from "@/lib/format";
import { shareLinks } from "@/modules/packing";
import { datesLine, documentsForPlan, planDetailById } from "@/modules/plans";
import { PLAN_PHASES, appConfig } from "../../../../../config/app.config";

export const metadata: Metadata = { title: "Production plan" };

function weekday(day: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(dateFromString(day));
}

/** Public, read-only production plan for a share link. No login. */
export default async function SharedPlanPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const link = await shareLinks.resolve(token);
  if (!link || link.targetType !== "plan") notFound();
  const detail = await planDetailById(link.targetId);
  if (!detail) notFound();
  const t = await getTranslations("plans");
  const tph = await getTranslations("planPhase");
  const tk = await getTranslations("logisticsKind");
  const { plan, project, days, tasks, logistics, crew, contacts } = detail;
  const docs = await documentsForPlan(plan.id);
  const fileUrl = (url: string) => `${url}${url.includes("?") ? "&" : "?"}share=${encodeURIComponent(token)}`;
  const pdf = (day?: string) => `/api/plans/${plan.id}/plan.pdf?share=${encodeURIComponent(token)}${day ? `&day=${day}` : ""}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <p className="text-xs text-muted-foreground">
        {appConfig.name} · {t("sharedView")}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
      <p className="text-sm text-muted-foreground">{[project.clientName, project.venueName, project.venueAddress].filter(Boolean).join(" · ")}</p>
      <p className="mt-1 text-sm">
        {datesLine(project)}
        {" · "}
        <a href={pdf()} className="underline">
          {t("fullPdf")}
        </a>
      </p>

      <h2 className="mt-6 border-b pb-1 text-sm font-medium">{t("schedule")}</h2>
      {days.length === 0 && <p className="mt-2 text-sm text-muted-foreground">{t("noSchedule")}</p>}
      {days.map((d) => (
        <section key={d.day} className="mt-3">
          <h3 className="flex items-baseline justify-between text-sm font-medium">
            <span>
              {weekday(d.day)} {formatDate(d.day)}
            </span>
            <a href={pdf(d.day)} className="text-xs font-normal underline">
              {t("daySheet")}
            </a>
          </h3>
          <ul className="divide-y text-sm">
            {d.entries.map((e) => (
              <li key={e.id} className="flex items-start gap-3 py-1.5">
                <span className="w-24 shrink-0 font-mono text-xs">
                  {e.time}
                  {e.endTime ? `–${e.endTime}` : ""}
                </span>
                <span className="min-w-0 flex-1">
                  {e.title}
                  <span className="block text-xs text-muted-foreground">{[e.location, e.responsibleName, e.notes].filter(Boolean).join(" · ")}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {(crew.length > 0 || contacts.length > 0) && (
        <>
          <h2 className="mt-6 border-b pb-1 text-sm font-medium">{t("crewAndContacts")}</h2>
          <ul className="divide-y text-sm">
            {[...crew.map((c) => ({ id: c.id, name: c.name, role: c.role, line: [c.phone, c.callTime ? `${t("callTime")} ${formatDateTime(c.callTime)}` : null].filter(Boolean).join(" · ") })), ...contacts.map((c) => ({ id: c.id, name: c.name, role: c.role, line: [c.phone, c.email].filter(Boolean).join(" · ") }))].map((c) => (
              <li key={c.id} className="py-1.5">
                {c.name}
                {c.role ? <span className="text-muted-foreground"> · {c.role}</span> : null}
                {c.line ? <span className="block text-xs text-muted-foreground">{c.line}</span> : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {logistics.length > 0 && (
        <>
          <h2 className="mt-6 border-b pb-1 text-sm font-medium">{t("logistics")}</h2>
          <ul className="divide-y text-sm">
            {logistics.map((l) => (
              <li key={l.id} className="py-1.5">
                <span className="text-xs text-muted-foreground">{tk(l.kind)} · </span>
                {l.title}
                {l.at ? <span className="text-muted-foreground"> · {formatDateTime(l.at)}</span> : null}
                {l.details ? <span className="block whitespace-pre-line text-xs text-muted-foreground">{l.details}</span> : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {tasks.length > 0 && (
        <>
          <h2 className="mt-6 border-b pb-1 text-sm font-medium">{t("tasks")}</h2>
          {PLAN_PHASES.map((phase) => {
            const list = tasks.filter((x) => x.phase === phase);
            if (list.length === 0) return null;
            return (
              <section key={phase} className="mt-2">
                <h3 className="text-xs font-medium text-muted-foreground">{tph(phase)}</h3>
                <ul className="divide-y text-sm">
                  {list.map((x) => (
                    <li key={x.id} className={`py-1.5 ${x.done ? "text-muted-foreground line-through" : ""}`}>
                      {x.done ? "✓ " : "○ "}
                      {x.title}
                      {x.assigneeName || x.dueDate ? <span className="text-xs text-muted-foreground no-underline"> · {[x.assigneeName, x.dueDate ? formatDate(x.dueDate) : null].filter(Boolean).join(" · ")}</span> : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}

      {docs.length > 0 && (
        <>
          <h2 className="mt-6 border-b pb-1 text-sm font-medium">{t("documents")}</h2>
          <ul className="divide-y text-sm">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-1.5">
                {d.latest.thumbUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(d.latest.thumbUrl)} alt="" className="size-10 rounded object-cover" />
                )}
                <span className="min-w-0 flex-1">
                  {d.name}
                  <span className="block text-xs text-muted-foreground">
                    {t("version")} {d.latest.version}
                    {d.pinnedTo ? ` · ${d.pinnedTo}` : ""}
                  </span>
                </span>
                {d.latest.pdfUrl && (
                  <a href={fileUrl(d.latest.pdfUrl)} className="text-xs underline">
                    PDF
                  </a>
                )}
                <a href={fileUrl(`${d.latest.url}?download=1`)} className="text-xs underline">
                  {t("download")}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      {plan.notes && <p className="mt-6 whitespace-pre-line text-sm text-muted-foreground">{plan.notes}</p>}
    </main>
  );
}
