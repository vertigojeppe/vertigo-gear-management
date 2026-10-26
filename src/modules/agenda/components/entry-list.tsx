import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { StatusPill } from "@/components/status-pill";
import { dateToZonedInput, type DateString } from "@/lib/dates";
import { ENTRY_KINDS } from "../../../../config/app.config";
import type { EntryRow } from "../queries";

/** "Mon 19.10" / "Man 19.10". */
function shortDay(d: DateString, locale: string) {
  const wd = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)).replace(".", "");
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${d.slice(8)}.${d.slice(5, 7)}`;
}

/** When an entry happens, in one line: "Mon 19.10 10:00–11:30", "Mon 19.10 – Fri 23.10". */
export function entryWhen(e: Pick<EntryRow, "allDay" | "startsAt" | "endsAt" | "from" | "to">, locale: string): string {
  if (e.allDay) return e.from === e.to ? shortDay(e.from, locale) : `${shortDay(e.from, locale)} – ${shortDay(e.to, locale)}`;
  const start = dateToZonedInput(e.startsAt).slice(11, 16);
  const end = dateToZonedInput(e.endsAt).slice(11, 16);
  return e.from === e.to ? `${shortDay(e.from, locale)} ${start}–${end}` : `${shortDay(e.from, locale)} ${start} – ${shortDay(e.to, locale)} ${end}`;
}

/** The name an entry goes by in lists: time off names the person. */
export function entryLabel(e: Pick<EntryRow, "kind" | "title" | "people">, offLabel: string): string {
  if (e.kind !== "time_off") return e.title;
  const who = e.people.map((p) => p.name).join(", ");
  return `${offLabel}: ${who}${e.title !== "Off" ? ` (${e.title})` : ""}`;
}

/** A short list of entries (a project's, or the coming ones), each linking to its page. */
export async function EntryList({ entries, showJob = true }: { entries: EntryRow[]; showJob?: boolean }) {
  const t = await getTranslations("agenda");
  const locale = (await getLocale()) === "da" ? "da-DK" : "en-GB";
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{t("none")}</p>;
  return (
    <ul className="divide-y rounded-md border text-sm">
      {entries.map((e) => (
        <li key={e.id}>
          <Link href={`/calendar/entries/${e.id}`} className="flex items-start gap-3 px-3 py-2 hover:bg-muted/50">
            <StatusPill color={ENTRY_KINDS.find((k) => k.key === e.kind)?.color ?? "gray"} className="mt-0.5 shrink-0">
              {t(`kind_${e.kind}`)}
            </StatusPill>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{entryLabel(e, t("off"))}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[entryWhen(e, locale), e.kind !== "time_off" && e.people.length ? e.people.map((p) => p.name).join(", ") : null, showJob ? e.projectName : null, e.location].filter(Boolean).join(" · ")}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
