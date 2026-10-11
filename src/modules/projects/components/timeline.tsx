import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "cn";
import { addDays, daysBetween, today, type DateString } from "@/lib/dates";
import { PROJECT_STATUSES, RENTAL_STATUSES } from "../../../../config/app.config";
import type { TimelineBar } from "../queries";

const COLORS: Record<string, string> = {
  green: "bg-green-200 text-green-900 dark:bg-green-900/60 dark:text-green-100",
  blue: "bg-blue-200 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100",
  purple: "bg-purple-200 text-purple-900 dark:bg-purple-900/60 dark:text-purple-100",
  amber: "bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100",
  red: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-100",
  gray: "bg-muted text-muted-foreground",
};

/**
 * Horizontal timeline: one row per project/rental, one column per day.
 * Server component; pure CSS grid, scrolls horizontally on phones.
 */
export async function Timeline({ from, to, bars, conflictDays }: { from: DateString; to: DateString; bars: TimelineBar[]; conflictDays: Set<DateString> }) {
  const t = await getTranslations("calendar");
  const days = daysBetween(from, to);
  const dayList = Array.from({ length: days }, (_, i) => addDays(from, i));
  const todayStr = today();
  const colorOf = (bar: TimelineBar) =>
    bar.kind === "project" ? (PROJECT_STATUSES.find((s) => s.key === bar.status)?.color ?? "gray") : (RENTAL_STATUSES.find((s) => s.key === bar.status)?.color ?? "gray");

  const monthLabel = (d: DateString) => new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

  if (bars.length === 0) return <p className="text-sm text-muted-foreground">{t("empty")}</p>;

  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="grid min-w-max text-xs" style={{ gridTemplateColumns: `200px repeat(${days}, 28px)` }}>
        {/* header */}
        <div className="sticky left-0 z-10 border-b border-r bg-card p-2 font-medium">{t("title")}</div>
        {dayList.map((d) => {
          const isToday = d === todayStr;
          const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
          const weekend = dow === 0 || dow === 6;
          return (
            <div
              key={d}
              className={cn("border-b border-r py-1 text-center leading-tight", weekend && "bg-muted/40", conflictDays.has(d) && "bg-red-100 dark:bg-red-900/40", isToday && "font-bold underline")}
              title={d}
            >
              <div className="text-[10px] text-muted-foreground">{d.endsWith("-01") || d === from ? monthLabel(d) : ""}</div>
              <div>{d.slice(8)}</div>
            </div>
          );
        })}
        {/* rows */}
        {bars.map((bar) => {
          const startIdx = Math.max(0, daysBetween(from, bar.from) - 1);
          const endIdx = Math.min(days - 1, daysBetween(from, bar.to) - 1);
          return (
            <div key={`${bar.kind}-${bar.id}`} className="contents">
              <div className="sticky left-0 z-10 border-b border-r bg-card p-2">
                <Link href={bar.href} className="block truncate font-medium hover:underline">
                  {bar.label}
                </Link>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {bar.kind === "rental" ? t("rentals") : bar.sub ?? ""}
                </span>
              </div>
              {dayList.map((d, i) => {
                const inBar = i >= startIdx && i <= endIdx;
                return (
                  <div key={d} className={cn("border-b border-r", conflictDays.has(d) && "bg-red-50 dark:bg-red-950/30")}>
                    {inBar && (
                      <Link
                        href={bar.href}
                        className={cn("block h-full min-h-8 py-1", COLORS[colorOf(bar)], i === startIdx && "ml-0.5 rounded-l", i === endIdx && "mr-0.5 rounded-r")}
                        title={`${bar.label} ${bar.from} – ${bar.to}`}
                      >
                        {i === startIdx && <span className="sticky left-[204px] truncate px-1 text-[10px]">{bar.label}</span>}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
