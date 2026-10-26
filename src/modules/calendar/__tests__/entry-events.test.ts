import { describe, expect, it } from "vitest";
import { entryGoogle, type GoogleEntry } from "../entry-events";

const base: GoogleEntry = {
  id: "e1",
  kind: "meeting",
  title: "Rig check",
  notes: "Bring the laser",
  location: "Vega",
  projectName: "Melo",
  allDay: false,
  startsAt: new Date("2030-07-01T08:00:00Z"),
  endsAt: new Date("2030-07-01T09:30:00Z"),
  guests: ["Venue@example.com"],
  creator: { name: "Alex", email: "alex@vertigo.dk" },
  people: [
    { name: "Alex", email: "alex@vertigo.dk" },
    { name: "Mette", email: "mette@vertigo.dk" },
  ],
};
const opts = { sharedCalendarId: "shared", appUrl: (p: string) => `https://gear.example${p}` };

describe("entryGoogle", () => {
  it("sends a meeting from the creator's calendar, inviting everyone else", () => {
    const t = entryGoogle(base, { ...opts, invites: true });
    expect(t).toMatchObject({ calendarId: "primary", subject: "alex@vertigo.dk", sendUpdates: true });
    expect(t.event.attendees).toEqual([{ email: "mette@vertigo.dk" }, { email: "venue@example.com" }]);
    expect(t.event.summary).toBe("Rig check");
    expect(t.event.description).toBe("Bring the laser\nJob: Melo\nPeople: Alex, Mette\nhttps://gear.example/calendar/entries/e1");
    expect(t.event.start).toEqual({ dateTime: "2030-07-01T08:00:00.000Z", timeZone: "Europe/Copenhagen" });
  });

  it("puts time off in the person's own calendar, whole days, nobody invited", () => {
    const t = entryGoogle({ ...base, kind: "time_off", title: "Holiday", allDay: true, startsAt: new Date("2030-07-01T00:00:00Z"), endsAt: new Date("2030-07-05T00:00:00Z"), people: [{ name: "Mette", email: "mette@vertigo.dk" }] }, { ...opts, invites: true });
    expect(t).toMatchObject({ calendarId: "primary", subject: "mette@vertigo.dk", sendUpdates: false });
    expect(t.event.attendees).toBeUndefined();
    expect(t.event.summary).toBe("Off (Holiday)");
    expect(t.event.end).toEqual({ date: "2030-07-06" });
  });

  it("uses the shared calendar with the names in the title when invitations are off", () => {
    expect(entryGoogle({ ...base, kind: "time_off", title: "Off", people: [{ name: "Mette", email: "m@x" }] }, { ...opts, invites: false })).toMatchObject({ calendarId: "shared", sendUpdates: false, event: { summary: "Off: Mette" } });
    expect(entryGoogle({ ...base, kind: "assignment", title: "Fix the hazer" }, { ...opts, invites: false }).event.summary).toBe("Fix the hazer (Alex, Mette)");
    expect(entryGoogle(base, { ...opts, invites: false }).subject).toBeUndefined();
  });
});
