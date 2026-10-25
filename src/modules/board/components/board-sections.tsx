import { getLocale, getTranslations } from "next-intl/server";
import { cn } from "cn";
import { daysBetween, type DateString } from "@/lib/dates";
import { StatusPill } from "@/components/status-pill";
import { PACKING_STATUSES } from "../../../../config/app.config";
import type { BoardPhase, AgendaItem } from "../logic";
import type { BoardJob } from "../queries";

/** "Mon 19.10" / "Man 19.10". */
function shortDay(d: DateString, locale: string) {
  const date = new Date(`${d}T00:00:00Z`);
  const wd = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(date).replace(".", "");
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${d.slice(8)}.${d.slice(5, 7)}`;
}

function phaseWhen(ph: BoardPhase, locale: string) {
  const days = ph.from === ph.to ? shortDay(ph.from, locale) : `${shortDay(ph.from, locale)} – ${shortDay(ph.to, locale)}`;
  const time = ph.time ? (ph.endTime ? `${ph.time}–${ph.endTime}` : ph.time) : "";
  return time ? `${days} · ${time}` : days;
}

/** One card per job of the coming days: when each phase is, who is on it, and how far the packing lists are. */
export async function JobCard({ job, today }: { job: BoardJob; today: DateString }) {
  const t = await getTranslations("board");
  const tph = await getTranslations("phase");
  const tps = await getTranslations("packingStatus");
  const locale = (await getLocale()) === "da" ? "da-DK" : "en-GB";
  const running = job.from <= today;
  const inDays = daysBetween(today, job.from) - 1;
  return (
    <article className={cn("mb-4 break-inside-avoid rounded-lg border bg-card p-4", running && "border-green-500/60")}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-2xl font-semibold leading-tight [overflow-wrap:anywhere]">{job.name}</h2>
        <StatusPill color={running ? "green" : inDays <= 2 ? "amber" : "gray"} className="shrink-0 text-sm">
          {running ? t("now") : inDays === 1 ? t("tomorrow") : t("inDays", { count: inDays })}
        </StatusPill>
      </div>
      {(job.clientName || job.venueName) && <p className="text-lg text-muted-foreground">{[job.clientName, job.venueName].filter(Boolean).join(" · ")}</p>}
      {job.phases.length > 0 && (
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 text-lg">
          {job.phases.map((ph) => (
            <div key={ph.phase} className="contents">
              <dt className="text-muted-foreground">{tph(ph.phase)}</dt>
              {/* Phases that are over fade; what is still to come stands out. */}
              <dd className={cn("tabular-nums", ph.to < today && "text-muted-foreground")}>{phaseWhen(ph, locale)}</dd>
            </div>
          ))}
        </dl>
      )}
      {job.crew.length > 0 && (
        <p className="mt-2 text-base">
          <span className="text-muted-foreground">{t("crew")}: </span>
          {job.crew.map((c) => (c.role ? `${c.name} (${c.role})` : c.name)).join(", ")}
        </p>
      )}
      {job.lists.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {job.lists.map((l) => {
            const packed = l.progress.units ? Math.round((l.progress.packed / l.progress.units) * 100) : 0;
            return (
              <li key={l.id} className="flex items-center gap-3 text-base">
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                {l.status === "draft" ? (
                  <>
                    <span className="h-2 w-24 shrink-0 overflow-hidden rounded bg-muted">
                      <span className="block h-full bg-green-500" style={{ width: `${packed}%` }} />
                    </span>
                    <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground">{t("packed", { packed: l.progress.packed, total: l.progress.units })}</span>
                  </>
                ) : (
                  <StatusPill color={PACKING_STATUSES.find((s) => s.key === l.status)?.color ?? "gray"} className="shrink-0 text-sm">
                    {tps(l.status)}
                  </StatusPill>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

/** Today's or tomorrow's agenda: what happens when, across all jobs and rentals. */
export async function AgendaDay({ title, day, items }: { title: string; day: DateString; items: AgendaItem[] }) {
  const t = await getTranslations("board");
  const tph = await getTranslations("phase");
  const locale = (await getLocale()) === "da" ? "da-DK" : "en-GB";
  const label = (i: AgendaItem) =>
    i.kind === "phase" ? `${tph(i.phase!)} · ${i.title}` : i.kind === "rental_out" ? t("rentalOut", { client: i.title }) : i.kind === "rental_back" ? t("rentalBack", { client: i.title }) : i.title;
  return (
    <section className="flex min-h-0 flex-col gap-2">
      <h2 className="text-xl font-semibold">
        {title} <span className="font-normal text-muted-foreground">{shortDay(day, locale)}</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-lg text-muted-foreground">{t("nothing")}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {items.map((i, n) => (
            <li key={n} className="flex gap-3 px-3 py-2 text-lg">
              <span className="w-28 shrink-0 tabular-nums text-muted-foreground">{i.time ? (i.endTime ? `${i.time}–${i.endTime}` : i.time) : t("allDay")}</span>
              <span className="min-w-0 flex-1">
                <span className="block leading-snug">{label(i)}</span>
                {(i.context || i.where) && <span className="block text-base text-muted-foreground">{[i.context, i.where].filter(Boolean).join(" · ")}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
