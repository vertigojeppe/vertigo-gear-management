import ical, { ICalCalendarMethod } from "ical-generator";
import { NextResponse, type NextRequest } from "next/server";
import { getActor } from "@/lib/auth/session";
import { addDays, dateToString } from "@/lib/dates";
import { publicOrigin } from "@/lib/request-origin";
import { entryDetail } from "@/modules/agenda";
import { appConfig } from "../../../../../../config/app.config";

/** One calendar entry as an .ics file, for calendars the app does not invite (Outlook, Apple, private Google accounts). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getActor())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const e = await entryDetail(id);
  if (!e) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const url = `${publicOrigin(req)}/calendar/entries/${e.id}`;
  const title = e.kind === "time_off" ? `Off${e.title !== "Off" ? ` (${e.title})` : ""}` : e.title;
  const cal = ical({ name: appConfig.name, timezone: appConfig.timezone, method: ICalCalendarMethod.PUBLISH });
  cal.createEvent({
    id: `${e.id}@vertigo-gear`,
    start: e.allDay ? new Date(`${dateToString(e.startsAt)}T00:00:00Z`) : e.startsAt,
    end: e.allDay ? new Date(`${addDays(dateToString(e.endsAt), 1)}T00:00:00Z`) : e.endsAt,
    allDay: e.allDay,
    summary: title,
    description: [e.notes, e.projectName ? `Job: ${e.projectName}` : null, e.people.map((p) => p.name).join(", ") || null, url].filter(Boolean).join("\n"),
    location: e.location ?? undefined,
    url,
  });
  return new NextResponse(cal.toString(), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${title.replace(/[^\w\- ]+/g, "").trim() || "entry"}.ics"`, "Cache-Control": "no-store" },
  });
}
