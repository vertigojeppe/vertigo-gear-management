import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { appSettings } from "@/modules/settings/app-settings";
// eslint-disable-next-line no-restricted-imports -- as above
import { syncEntry } from "@/modules/calendar/sync";
// eslint-disable-next-line no-restricted-imports -- as above
import { GoogleDelegationError, type GoogleCalendar, type GoogleEvent } from "@/modules/calendar/google";
import { entries } from "../service";
import { entriesBetween, entryDetail } from "../queries";
import type { EntryInput } from "../schema";

/**
 * Calendar entries against the dev database, and their Google sync with a
 * fake client per acting user (no network). Test users are viewers in the
 * database (other tests pick "any admin"); the actor acts as a member here.
 */
class FakeGoogle {
  calls: { subject: string | undefined; method: string; calendarId: string; eventId: string | null; event?: GoogleEvent; sendUpdates?: boolean }[] = [];
  refuse = new Set<string>();
  private n = 0;
  client = (subject?: string) =>
    ({
      upsert: async (calendarId: string, eventId: string | null, event: GoogleEvent, opts: { sendUpdates?: boolean } = {}) => {
        if (subject && this.refuse.has(subject)) throw new GoogleDelegationError(`no ${subject}`);
        this.calls.push({ subject, method: eventId ? "update" : "create", calendarId, eventId, event, sendUpdates: opts.sendUpdates });
        return eventId ?? `evt-${++this.n}`;
      },
      delete: async (calendarId: string, eventId: string, opts: { sendUpdates?: boolean } = {}) => {
        this.calls.push({ subject, method: "delete", calendarId, eventId, sendUpdates: opts.sendUpdates });
      },
    }) as unknown as GoogleCalendar;
}

const marker = `agenda-${Date.now().toString(36)}`;
const actor: Actor = { id: "", email: "", name: "Ann Agenda", role: "member" };
const annEmail = `ann-${marker}@vertigo.test`;
const boEmail = `bo-${marker}@vertigo.test`;
let annId = "";
let boId = "";
let invitesBefore: unknown = null;

const meeting = (over: Partial<EntryInput> = {}): EntryInput => ({ kind: "meeting", title: `Rig check ${marker}`, allDay: false, fromDate: "2031-03-10", startTime: "10:00", endTime: "11:00", guestsText: "venue@example.com", ...over });

beforeAll(async () => {
  vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON", JSON.stringify({ client_email: "sa@example.iam.gserviceaccount.com", private_key: "unused" }));
  vi.stubEnv("GOOGLE_CALENDAR_ID_PROJECTS", "shared");
  annId = (await prisma.user.create({ data: { email: annEmail, name: "Ann Agenda", passwordHash: "x", role: "viewer" } })).id;
  boId = (await prisma.user.create({ data: { email: boEmail, name: "Bo Agenda", passwordHash: "x", role: "viewer" } })).id;
  actor.id = annId;
  actor.email = annEmail;
  invitesBefore = (await prisma.appSetting.findUnique({ where: { key: "calendarInvites" } }))?.value ?? null;
});

afterAll(async () => {
  vi.unstubAllEnvs();
  const ids = (await prisma.calendarEntry.findMany({ where: { OR: [{ title: { contains: marker } }, { createdById: { in: [annId, boId] } }] }, select: { id: true } })).map((e) => e.id);
  await prisma.calendarEntry.deleteMany({ where: { id: { in: ids } } });
  await prisma.outbox.deleteMany({ where: { type: "calendar.sync_entry", OR: ids.map((id) => ({ payload: { path: ["id"], equals: id } })) } });
  await prisma.activityLog.deleteMany({ where: { OR: [{ entityId: { in: ids } }, { userId: { in: [annId, boId] } }] } });
  await prisma.user.deleteMany({ where: { id: { in: [annId, boId] } } });
  await prisma.appSetting.deleteMany({ where: { key: "calendarInvites" } });
  if (invitesBefore !== null) await prisma.appSetting.create({ data: { key: "calendarInvites", value: invitesBefore as boolean } });
});

describe("entries", () => {
  it("makes time off for the person making it, and refuses two people", async () => {
    const id = await entries.create(actor, { kind: "time_off", title: `Holiday ${marker}`, allDay: false, fromDate: "2031-03-02", toDate: "2031-03-06" }, []);
    expect(await entryDetail(id)).toMatchObject({ kind: "time_off", allDay: true, from: "2031-03-02", to: "2031-03-06", people: [{ id: annId, name: "Ann Agenda" }] });
    await expect(entries.create(actor, { kind: "time_off", allDay: true, fromDate: "2031-03-02" }, [annId, boId])).rejects.toThrow("Time off is for one person; make one entry each.");
  });

  it("finds a meeting by day and by person, and queues a Google sync when it changes", async () => {
    const id = await entries.create(actor, meeting(), [annId, boId]);
    expect((await entriesBetween("2031-03-10", "2031-03-10", { userId: boId })).map((e) => e.id)).toContain(id);
    expect((await entriesBetween("2031-03-11", "2031-03-12", { userId: boId })).map((e) => e.id)).not.toContain(id);
    await entries.update(actor, id, meeting({ startTime: "13:00", endTime: "14:00" }), [boId]);
    expect((await entryDetail(id))?.people.map((p) => p.id)).toEqual([boId]);
    expect(await prisma.outbox.count({ where: { type: "calendar.sync_entry", payload: { path: ["id"], equals: id } } })).toBeGreaterThan(0);
  });
});

describe("syncEntry", () => {
  it("goes to the shared calendar while invitations are off", async () => {
    await appSettings.setCalendarInvites({ ...actor, role: "admin" }, false);
    const id = await entries.create(actor, meeting(), [annId, boId]);
    const g = new FakeGoogle();
    expect(await syncEntry(id, g.client)).toBe("shared");
    expect(g.calls).toEqual([expect.objectContaining({ subject: undefined, method: "create", calendarId: "shared", sendUpdates: false })]);
    expect((await prisma.calendarEntry.findUniqueOrThrow({ where: { id } })).googleEvent).toEqual({ calendarId: "shared", subject: null, eventId: "evt-1" });
  });

  it("sends from the creator's calendar with invitations on, and falls back to the shared calendar when Google refuses", async () => {
    await appSettings.setCalendarInvites({ ...actor, role: "admin" }, true);
    const id = await entries.create(actor, meeting(), [annId, boId]);
    const g = new FakeGoogle();
    expect(await syncEntry(id, g.client)).toBe("invited");
    expect(g.calls[0]).toMatchObject({ subject: annEmail, calendarId: "primary", sendUpdates: true });
    expect(g.calls[0].event?.attendees).toEqual([{ email: boEmail }, { email: "venue@example.com" }]);

    // Google stops accepting Ann (delegation withdrawn): the event moves to the shared calendar.
    g.refuse.add(annEmail);
    expect(await syncEntry(id, g.client)).toBe("shared");
    expect(g.calls.slice(1).map((c) => [c.subject, c.method, c.calendarId])).toEqual([
      [annEmail, "delete", "primary"],
      [undefined, "create", "shared"],
    ]);
  });

  it("removes the Google event of a deleted entry from the reference its job carries", async () => {
    const id = await entries.create(actor, meeting(), [annId]);
    const ref = { calendarId: "primary", subject: "ann@vertigo.dk", eventId: "evt-9" };
    await prisma.calendarEntry.update({ where: { id }, data: { googleEvent: ref } });
    await entries.remove(actor, id);
    const job = await prisma.outbox.findFirstOrThrow({ where: { type: "calendar.sync_entry", payload: { path: ["id"], equals: id } }, orderBy: { createdAt: "desc" } });
    expect((job.payload as { eventIds?: unknown }).eventIds).toEqual(ref);
    const g = new FakeGoogle();
    expect(await syncEntry(id, g.client, ref)).toBe("deleted");
    expect(g.calls).toEqual([{ subject: "ann@vertigo.dk", method: "delete", calendarId: "primary", eventId: "evt-9", sendUpdates: true }]);
  });
});
