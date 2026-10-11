import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireActor } from "@/lib/auth/session";
import { addDays, today } from "@/lib/dates";
import { Timeline, timeline } from "@/modules/projects";

export const metadata: Metadata = { title: "Calendar" };

const DEFAULT_WEEKS = 6;

export default async function CalendarPage(props: { searchParams: Promise<{ from?: string; weeks?: string }> }) {
  await requireActor();
  const sp = await props.searchParams;
  const t = await getTranslations("calendar");
  const weeks = Math.min(16, Math.max(2, Number(sp.weeks) || DEFAULT_WEEKS));
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : addDays(today(), -3);
  const to = addDays(from, weeks * 7 - 1);
  const data = await timeline(from, to);
  const conflictDays = new Set(data.conflicts.flatMap((c) => c.days.map((d) => d.day)));
  const link = (f: string, w = weeks) => `/calendar?from=${f}&weeks=${w}`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <Link href={link(addDays(from, -weeks * 7))} className={buttonVariants({ variant: "outline", size: "sm" })}>
              ← {t("previous")}
            </Link>
            <Link href={link(addDays(today(), -3))} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("today")}
            </Link>
            <Link href={link(addDays(from, weeks * 7))} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("next")} →
            </Link>
            <Link href={link(from, weeks === 6 ? 12 : 6)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {t("weeks", { count: weeks === 6 ? 12 : 6 })}
            </Link>
          </>
        }
      />
      <Timeline from={from} to={to} bars={data.bars} conflictDays={conflictDays} />
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t("conflicts")}</h2>
        {data.conflicts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noConflicts")}</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {data.conflicts.map((c) => (
              <li key={c.modelId} className="px-3 py-2">
                <Link href={`/inventory/models/${c.modelId}`} className="hover:underline">
                  {t("conflictLine", { model: c.modelLabel, days: c.days.length, peak: Math.max(...c.days.map((d) => d.shortfall)), holders: c.holders.join(", ") })}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
