import { getLocale } from "next-intl/server";
import { cn } from "cn";
import { addDays, daysBetween, type DateString } from "@/lib/dates";
import { type TimelineBar } from "@/modules/projects";
import { barColor } from "@/modules/projects/components/timeline";
import { barSpan, packLanes } from "../logic";

/**
 * Months ahead on one screen width: every job and rental as a bar, packed
 * into as few rows as possible (bars that do not overlap share a row).
 * Month starts are marked with a line and a label; the window starts today.
 */
export async function LongTimeline({ from, to, bars }: { from: DateString; to: DateString; bars: TimelineBar[] }) {
  const locale = (await getLocale()) === "da" ? "da-DK" : "en-GB";
  const days = daysBetween(from, to);
  const lanes = packLanes(bars);
  const monthName = (d: DateString) => new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)).replace(".", "");
  const months: { day: DateString; left: number; label: string }[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    if (i === 0 || d.endsWith("-01")) months.push({ day: d, left: (i / days) * 100, label: d.endsWith("-01-01") || i === 0 ? `${monthName(d)} ${d.slice(0, 4)}` : monthName(d) });
  }
  // Late in a month the first label would run into the next one: drop it and put the year on the next.
  if (months.length > 1 && months[1].left < 6) {
    months.shift();
    months[0].label = `${monthName(months[0].day)} ${months[0].day.slice(0, 4)}`;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border">
      <div className="relative h-7 shrink-0 border-b text-sm text-muted-foreground">
        {months.map((m) => (
          <span key={m.day} className="absolute top-1 whitespace-nowrap pl-1.5 first-letter:uppercase" style={{ left: `${m.left}%` }}>
            {m.label}
          </span>
        ))}
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden py-1">
        {months.filter((m) => m.left > 0).map((m) => (
          <span key={m.day} aria-hidden className="absolute inset-y-0 border-l border-muted-foreground/30" style={{ left: `${m.left}%` }} />
        ))}
        {lanes.map((lane, i) => (
          <div key={i} className="relative mb-1 h-7">
            {lane.map((bar) => {
              const { left, width } = barSpan(bar, from, days);
              return (
                <div
                  key={`${bar.kind}-${bar.id}`}
                  className={cn("absolute inset-y-0 overflow-hidden rounded px-1.5 text-sm leading-7 whitespace-nowrap", barColor(bar))}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${bar.label} ${bar.from} – ${bar.to}`}
                >
                  {bar.label}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
