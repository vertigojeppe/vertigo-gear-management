import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/language-toggle";
import { can, requireActor } from "@/lib/auth/session";
import { AgendaDay, BoardClock, BoardRefresh, BoardThemeToggle, JobCard, LongTimeline, boardData, boardThemeScript } from "@/modules/board";
import { signOutAction } from "../(app)/actions";
import { appConfig } from "../../../config/app.config";

export const metadata: Metadata = { title: "Board" };

/**
 * The office screen: one page, full screen, no navigation. Made for the
 * "display" role (Settings › Users), which sees nothing else, but anyone
 * signed in may open it. `?months=` (1–12, default 6) sets how far the
 * timeline at the bottom looks ahead; `?theme=light|dark` sets (and this
 * screen remembers) its theme, dark by default, also switchable in the footer.
 */
export default async function BoardPage(props: { searchParams: Promise<{ months?: string; theme?: string }> }) {
  const actor = await requireActor();
  if (!can(actor.role, "board.read")) notFound();
  const sp = await props.searchParams;
  const months = Math.min(12, Math.max(1, Math.round(Number(sp.months) || 6)));
  const themeFromUrl = sp.theme === "light" || sp.theme === "dark" ? sp.theme : null;
  const data = await boardData({ months });
  const t = await getTranslations("board");
  const [todayAgenda, tomorrowAgenda] = data.agenda;

  return (
    <div>
      {/* The board's own theme, applied before the first paint (dark unless this screen chose light). */}
      <script dangerouslySetInnerHTML={{ __html: boardThemeScript(themeFromUrl) }} />
      <main className="flex h-dvh flex-col gap-5 overflow-hidden bg-background p-6 text-foreground">
        <BoardRefresh />
        <header className="flex shrink-0 items-start justify-between gap-6">
          <div>
            <p className="text-lg text-muted-foreground">{appConfig.name}</p>
            <h1 className="text-4xl font-semibold">{t("title")}</h1>
          </div>
          <BoardClock />
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="min-h-0 overflow-hidden" aria-label={t("jobs")}>
            {data.jobs.length === 0 ? (
              <p className="text-xl text-muted-foreground">{t("noJobs")}</p>
            ) : (
              <div className="gap-4 md:columns-2 2xl:columns-3">
                {data.jobs.map((job) => (
                  <JobCard key={job.id} job={job} today={data.today} />
                ))}
              </div>
            )}
          </section>
          <aside className="flex min-h-0 flex-col gap-5 overflow-hidden">
            <AgendaDay title={t("today")} day={todayAgenda.day} items={todayAgenda.items} />
            <AgendaDay title={t("tomorrow")} day={tomorrowAgenda.day} items={tomorrowAgenda.items} />
          </aside>
        </div>

        <section className="h-[28vh] shrink-0" aria-label={t("timeline", { months })}>
          <LongTimeline from={data.timeline.from} to={data.timeline.to} bars={data.timeline.bars} />
        </section>

        <footer className="flex shrink-0 items-center justify-end gap-3 text-xs text-muted-foreground opacity-60 hover:opacity-100">
          <span>{actor.name}</span>
          <BoardThemeToggle />
          <LanguageToggle compact />
          <form action={signOutAction}>
            <button type="submit" className="underline">
              {t("signOut")}
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}
