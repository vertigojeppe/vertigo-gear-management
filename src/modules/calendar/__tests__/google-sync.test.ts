import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
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

describe("projectPhaseEvents", () => {
  it("builds one event per phase that has a date, all-day for the day ranges", () => {
    const events = projectPhaseEvents({
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
    });
    expect(Object.keys(events).sort()).toEqual(["load_in", "prep", "return", "show"]);
    expect(events.prep?.start).toEqual({ date: "2030-05-30" });
    expect(events.prep?.end).toEqual({ date: "2030-06-01" }); // exclusive end after the last prep day
    expect(events.load_in?.summary).toBe("Show – build-up (call 07:30)");
    expect(events.load_in?.start).toEqual({ date: "2030-06-01" });
    expect(events.load_in?.end).toEqual({ date: "2030-06-03" });
    expect(events.return?.end).toEqual({ date: "2030-06-04" });
    expect(events.show?.summary).toBe("Show – show");
    expect(events.show?.attendees).toEqual([{ email: "a@example.com" }]);
    expect(events.show?.location).toBe("Vega");
  });
});

describe("syncProject", () => {
  it("creates events the first time and updates them with stored ids afterwards", async () => {
    const fake = new FakeGoogle();
    expect(await syncProject(projectId, fake as unknown as GoogleCalendar)).toBe("synced");
    expect(fake.calls.filter((c) => c.method === "create")).toHaveLength(5);
    const stored = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).googleEventIds as Record<string, string>;
    expect(Object.keys(stored).sort()).toEqual(["load_in", "load_out", "prep", "return", "show"]);

    const fake2 = new FakeGoogle();
    expect(await syncProject(projectId, fake2 as unknown as GoogleCalendar)).toBe("synced");
    expect(fake2.calls.every((c) => c.method === "update")).toBe(true);
    expect(fake2.calls.map((c) => c.eventId).sort()).toEqual(Object.values(stored).sort());
  });

  it("deletes the events when the project is cancelled", async () => {
    await prisma.project.update({ where: { id: projectId }, data: { status: "cancelled" } });
    const fake = new FakeGoogle();
    expect(await syncProject(projectId, fake as unknown as GoogleCalendar)).toBe("deleted");
    expect(fake.calls.filter((c) => c.method === "delete")).toHaveLength(5);
    const stored = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).googleEventIds;
    expect(stored).toEqual({});
  });
});
