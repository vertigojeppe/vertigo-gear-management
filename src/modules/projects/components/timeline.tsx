import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { cn } from "cn";
import { addDays, daysBetween, isoWeek, isoWeekday, today, type DateString } from "@/lib/dates";
import { PROJECT_STATUSES, RENTAL_STATUSES } from "../../../../config/app.config";
import type { TimelineBar } from "../queries";

/** Bar colours by status colour key; also used by the office screen's long timeline. */
export const BAR_COLORS: Record<string, string> = {
  green: "bg-green-200 text-green-900 dark:bg-green-900/60 dark:text-green-100",
  blue: "bg-blue-200 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100",
  purple: "bg-purple-200 text-purple-900 dark:bg-purple-900/60 dark:text-purple-100",
  amber: "bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100",
  red: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-100",
  gray: "bg-muted text-muted-foreground",
};

/** The Tailwind classes for a bar: its status colour. */
export function barColor(bar: Pick<TimelineBar, "kind" | "status">): string {
  const key = bar.kind === "project" ? (PROJECT_STATUSES.find((s) => s.key === bar.status)?.color ?? "gray") : (RENTAL_STATUSES.find((s) => s.key === bar.status)?.color ?? "gray");
  return BAR_COLORS[key] ?? BAR_COLORS.gray;
}

/** Sundays' right edge (the line every cell already has) is drawn darker, so weeks stand apart without a thicker line. */
const WEEK_END = "border-r-muted-foreground/50";

/**
 * Horizontal timeline: one row per project/rental, one column per day.
 * Above the days, a row with the (ISO) week number spanning each week
 * and the year in its corner; every day shows its weekday. Server component; pure CSS grid, scrolls
 * horizontally on phones.
 */
export async function Timeline({ from, to, bars, conflictDays }: { from: DateString; to: DateString; bars: TimelineBar[]; conflictDays: Set<DateString> }) {
  const t = await getTranslations("calendar");
  const days = daysBetween(from, to);
  const dayList = Array.from({ length: days }, (_, i) => addDays(from, i));
  const todayStr = today();

  const locale = (await getLocale()) === "da" ? "da-DK" : "en-GB";
  const monthLabel = (d: DateString) => new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)).replace(".", "");
  // Two letters fit a 28 px column: "Ma", "Ti" … / "Mo", "Tu" …
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const weekdayLabel = (d: DateString) => {
    const w = weekdayFormat.format(new Date(`${d}T00:00:00Z`)).replace(".", "");
    return w.charAt(0).toUpperCase() + w.slice(1, 2);
  };
  const weekEnd = (d: DateString, i: number) => i < days - 1 && isoWeekday(d) === 7;
  // The year: in the corner ("2026", or "2026–2027" across New Year), and on the month label where a new year starts.
  const years = from.slice(0, 4) === to.slice(0, 4) ? from.slice(0, 4) : `${from.slice(0, 4)}–${to.slice(0, 4)}`;
  const monthHeading = (d: DateString) => (d.endsWith("-01-01") ? `${monthLabel(d)} ${d.slice(0, 4)}` : monthLabel(d));
  // The week row: one cell per week, as wide as that week's days in the window (the first and last may be partial).
  const weeks: { week: number; start: DateString; span: number }[] = [];
  dayList.forEach((d, i) => {
    if (i === 0 || isoWeekday(d) === 1) weeks.push({ week: isoWeek(d), start: d, span: 1 });
    else weeks[weeks.length - 1].span++;
  });

  if (bars.length === 0) return <p className="text-sm text-muted-foreground">{t("empty")}</p>;

  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="grid min-w-max text-xs" style={{ gridTemplateColumns: `200px repeat(${days}, 28px)` }}>
        {/* week numbers */}
        <div className="sticky left-0 z-10 border-b border-r bg-card px-2 py-1 font-medium">
          {years}
        </div>
        {weeks.map((w, i) => (
          <div key={w.start} className={cn("border-b border-r bg-muted/20 px-1 py-1 text-center font-medium", i < weeks.length - 1 && WEEK_END)} style={{ gridColumn: `span ${w.span}` }} title={t("weekLabel", { week: w.week })}>
            {w.week}
          </div>
        ))}
        {/* days */}
        <div className="sticky left-0 z-10 border-b border-r bg-card" />
        {dayList.map((d, i) => {
          const isToday = d === todayStr;
          const weekend = isoWeekday(d) >= 6;
          return (
            <div
              key={d}
              className={cn("border-b border-r py-1 text-center leading-tight", weekend && "bg-muted/40", conflictDays.has(d) && "bg-red-100 dark:bg-red-900/40", weekEnd(d, i) && WEEK_END, isToday && "font-bold")}
              title={d}
            >
              <div className="whitespace-nowrap text-[10px] text-muted-foreground">{d.endsWith("-01") || d === from ? monthHeading(d) : "\u00a0"}</div>
              <div className={cn("text-[10px]", weekend ? "text-muted-foreground" : "")}>{weekdayLabel(d)}</div>
              <div className={cn(isToday && "underline")}>{d.slice(8)}</div>
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
                  <div key={d} className={cn("border-b border-r", conflictDays.has(d) && "bg-red-50 dark:bg-red-950/30", weekEnd(d, i) && WEEK_END)}>
                    {inBar && (
                      <Link
                        href={bar.href}
                        className={cn("block h-full min-h-8 py-1", barColor(bar), i === startIdx && "ml-0.5 rounded-l", i === endIdx && "mr-0.5 rounded-r")}
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
