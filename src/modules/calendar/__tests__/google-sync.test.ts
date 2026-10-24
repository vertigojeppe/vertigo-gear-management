import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { projects } from "@/modules/projects/service";
import { projectPhaseEvents, syncProject } from "../sync";
import type { GoogleCalendar, GoogleEvent } from "../google";

/**
 * Google push is one-way and idempotent: event ids are stored per phase and
 * reused. A fake client records calls; no network.
 */
class FakeGoogle {
  calls: { method: string; calendarId: string; eventId: string | null; event?: GoogleEvent }[] = [];
  private n = 0;
  async upsert(calendarId: string, eventId: string | null, event: GoogleEvent): Promise<string> {
    this.calls.push({ method: eventId ? "update" : "create", calendarId, eventId, event });
    return eventId ?? `evt-${++this.n}`;
  }
  async delete(calendarId: string, eventId: string): Promise<void> {
    this.calls.push({ method: "delete", calendarId, eventId });
  }
}

const marker = `gcal-${Date.now()}`;
let projectId: string;

beforeAll(async () => {
  vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON", JSON.stringify({ client_email: "sa@example.iam.gserviceaccount.com", private_key: "unused" }));
  vi.stubEnv("GOOGLE_CALENDAR_ID_PROJECTS", "cal-projects");
  const p = await prisma.project.create({
    data: {
      name: `Sync ${marker}`,
      status: "confirmed",
      venueName: "Vega",
      prepStart: new Date("2030-06-01T00:00:00Z"),
      prepEnd: new Date("2030-06-01T00:00:00Z"),
      buildStart: new Date("2030-06-02T00:00:00Z"),
      buildCall: "08:00",
      showStart: new Date("2030-06-02T18:00:00Z"),
      showEnd: new Date("2030-06-02T21:00:00Z"),
      packStart: new Date("2030-06-03T00:00:00Z"),
      returnDate: new Date("2030-06-03T00:00:00Z"),
      reserveFrom: new Date("2030-06-01T00:00:00Z"),
      reserveTo: new Date("2030-06-03T00:00:00Z"),
    },
  });
  projectId = p.id;
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.$disconnect();
});

const input = {
  id: "x",
  name: "Show",
  venueName: "Vega",
  venueAddress: null,
  prepStart: new Date("2030-05-30T00:00:00Z"),
  prepEnd: new Date("2030-05-31T00:00:00Z"),
  buildStart: new Date("2030-06-01T00:00:00Z"),
  buildEnd: new Date("2030-06-02T00:00:00Z"),
  buildCall: "07:30",
  showStart: new Date("2030-06-02T18:00:00Z"),
  showEnd: new Date("2030-06-02T21:00:00Z"),
  packStart: null,
  packEnd: null,
  packCall: null,
  returnDate: new Date("2030-06-03T00:00:00Z"),
  client: { name: "Vega" },
  crew: [{ user: { googleEmail: "a@example.com" } }, { user: { googleEmail: null } }],
};

describe("projectPhaseEvents", () => {
  it("builds one banner over the job, a timed event per build-up day and the show", () => {
    const events = projectPhaseEvents(input);
    expect(Object.keys(events).sort()).toEqual(["job", "load_in:2030-06-01", "load_in:2030-06-02", "show"]);
    expect(events.job.summary).toBe("Show");
    expect(events.job.start).toEqual({ date: "2030-05-30" });
    expect(events.job.end).toEqual({ date: "2030-06-04" }); // exclusive end after the return day
    expect(events.job.description).toContain("Prep: 30.05.2030 – 31.05.2030");
    expect(events.job.description).toContain("Build-up: 01.06.2030 – 02.06.2030, call 07:30");
    expect(events.job.description).toContain("Return: 03.06.2030");
    // 07:30 in Copenhagen (summer time) is 05:30 UTC; two hours by default.
    expect(events["load_in:2030-06-01"].summary).toBe("Show – build-up (call 07:30)");
    expect(events["load_in:2030-06-01"].start).toEqual({ dateTime: "2030-06-01T05:30:00.000Z", timeZone: "Europe/Copenhagen" });
    expect(events["load_in:2030-06-01"].end).toEqual({ dateTime: "2030-06-01T07:30:00.000Z", timeZone: "Europe/Copenhagen" });
    expect(events.show.summary).toBe("Show – show");
    expect(events.show.attendees).toEqual([{ email: "a@example.com" }]);
    expect(events.show.location).toBe("Vega");
  });

  it("uses the length set under Settings › Calendar", () => {
    const events = projectPhaseEvents(input, { callHours: 3.5 });
    expect(events["load_in:2030-06-02"].end).toEqual({ dateTime: "2030-06-02T09:00:00.000Z", timeZone: "Europe/Copenhagen" });
  });
});

describe("syncProject", () => {
  it("creates events the first time and updates them with stored ids afterwards", async () => {
    const fake = new FakeGoogle();
    expect(await syncProject(projectId, fake as unknown as GoogleCalendar)).toBe("synced");
    // Banner, the build-up day with a call time, the show. Pack-down has no call time: banner only.
    expect(fake.calls.filter((c) => c.method === "create")).toHaveLength(3);
    const stored = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).googleEventIds as Record<string, string>;
    expect(Object.keys(stored).sort()).toEqual(["job", "load_in:2030-06-02", "show"]);

    const fake2 = new FakeGoogle();
    expect(await syncProject(projectId, fake2 as unknown as GoogleCalendar)).toBe("synced");
    expect(fake2.calls.every((c) => c.method === "update")).toBe(true);
    expect(fake2.calls.map((c) => c.eventId).sort()).toEqual(Object.values(stored).sort());
  });

  it("removes the per-phase all-day events from before the banner", async () => {
    const before = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).googleEventIds as Record<string, string>;
    await prisma.project.update({ where: { id: projectId }, data: { googleEventIds: { prep: "old-prep", load_in: "old-build", load_out: "old-pack", return: "old-return", show: before.show } } });
    const fake = new FakeGoogle();
    expect(await syncProject(projectId, fake as unknown as GoogleCalendar)).toBe("synced");
    expect(fake.calls.filter((c) => c.method === "delete").map((c) => c.eventId).sort()).toEqual(["old-build", "old-pack", "old-prep", "old-return"]);
    expect(fake.calls.find((c) => c.eventId === before.show)?.method).toBe("update");
  });

  it("deletes the events when the project is cancelled", async () => {
    await prisma.project.update({ where: { id: projectId }, data: { status: "cancelled" } });
    const fake = new FakeGoogle();
    expect(await syncProject(projectId, fake as unknown as GoogleCalendar)).toBe("deleted");
    expect(fake.calls.filter((c) => c.method === "delete")).toHaveLength(3);
    const stored = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).googleEventIds;
    expect(stored).toEqual({});
  });

  it("still removes the events of a deleted project, from the ids its job carries", async () => {
    const fake = new FakeGoogle();
    expect(await syncProject("no-such-project", fake as unknown as GoogleCalendar, { job: "evt-job", show: "evt-show" })).toBe("deleted");
    expect(fake.calls.map((c) => [c.method, c.eventId])).toEqual([
      ["delete", "evt-job"],
      ["delete", "evt-show"],
    ]);
  });

  it("hands a deleted project's event ids to its last sync job", async () => {
    const admin: Actor = { id: (await prisma.user.findFirstOrThrow({ where: { role: "admin" } })).id, email: "", name: "Alex Admin", role: "admin" };
    const doomed = await prisma.project.create({ data: { name: `Doomed ${marker}`, status: "confirmed", googleEventIds: { job: "evt-a", show: "evt-b" } } });
    await projects.remove(admin, doomed.id);
    const job = await prisma.outbox.findFirstOrThrow({ where: { type: "calendar.sync_project", payload: { path: ["id"], equals: doomed.id } }, orderBy: { createdAt: "desc" } });
    expect((job.payload as { eventIds?: unknown }).eventIds).toEqual({ job: "evt-a", show: "evt-b" });
    await prisma.outbox.deleteMany({ where: { payload: { path: ["id"], equals: doomed.id } } });
    await prisma.activityLog.deleteMany({ where: { entityId: doomed.id } });
  });
});
