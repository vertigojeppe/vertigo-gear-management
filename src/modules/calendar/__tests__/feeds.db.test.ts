import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { buildFeed, feedTokens } from "../feeds";

const marker = `feed-${Date.now()}`;
let projectId: string;
let userId: string;

beforeAll(async () => {
  userId = (await prisma.user.findFirstOrThrow({ where: { role: "admin" } })).id;
  const p = await prisma.project.create({
    data: {
      name: `Feed ${marker}`,
      status: "confirmed",
      buildStart: new Date("2030-06-29T00:00:00Z"),
      buildEnd: new Date("2030-07-01T00:00:00Z"),
      buildCall: "08:00",
      showStart: new Date("2030-07-01T18:00:00Z"),
      showEnd: new Date("2030-07-01T21:00:00Z"),
      reserveFrom: new Date("2030-06-29T00:00:00Z"),
      reserveTo: new Date("2030-07-01T00:00:00Z"),
      crew: { create: { userId, role: "Op" } },
    },
  });
  projectId = p.id;
});

afterAll(async () => {
  await prisma.project.delete({ where: { id: projectId } });
  await prisma.$disconnect();
});

describe("iCal feeds", () => {
  it("issues a stable token per scope and rotates it on demand", async () => {
    const a = await feedTokens.ensure("projects", null);
    const b = await feedTokens.ensure("projects", null);
    expect(a.token).toBe(b.token);
    const c = await feedTokens.rotate("projects", null);
    expect(c.token).not.toBe(a.token);
    expect(await feedTokens.resolve(a.token)).toBeNull();
    expect((await feedTokens.resolve(c.token))?.scope).toBe("projects");
  });

  it("renders one banner per job, timed build-up days and the show, with a link back", async () => {
    const ics = await buildFeed("projects", null);
    expect(ics).toContain("BEGIN:VCALENDAR");
    const events = ics.split("BEGIN:VEVENT").filter((e) => e.includes(projectId));
    // The banner covers the whole job (end exclusive) and lists the phases.
    const banner = events.find((e) => e.includes(`${projectId}-job@`))!;
    expect(banner).toMatch(/DTSTART;VALUE=DATE:20300629/);
    expect(banner).toMatch(/DTEND;VALUE=DATE:20300702/);
    expect(banner).toContain(`SUMMARY:Feed ${marker}`);
    // iCal folds long lines (CRLF + space) and escapes commas.
    expect(banner.replace(/\r\n /g, "")).toContain("Build-up: 29.06.2030 – 01.07.2030\\, call 08:00");
    // Build-up: one timed event per day from the call time; no all-day phase events any more.
    expect(events.filter((e) => e.includes(`${projectId}-load_in:`))).toHaveLength(3);
    expect(ics).toContain(`SUMMARY:Feed ${marker} – build-up (call 08:00)`);
    expect(events.filter((e) => /VALUE=DATE:/.test(e))).toHaveLength(1);
    expect(ics).toContain(`SUMMARY:Feed ${marker} – show`);
    expect(ics).toContain(`/projects/${projectId}`);
  });

  it("'mine' only includes projects where the user is on the crew", async () => {
    const mine = await buildFeed("mine", userId);
    expect(mine).toContain(`Feed ${marker}`);
    const other = await prisma.user.findFirst({ where: { role: "viewer" } });
    if (other) {
      const theirs = await buildFeed("mine", other.id);
      expect(theirs).not.toContain(`Feed ${marker}`);
    }
  });
});

describe("feed history", () => {
  it("leaves out jobs that ended more than a year ago", async () => {
    const old = await prisma.project.create({
      data: { name: `Old feed ${marker}`, status: "done", buildStart: new Date("2020-03-01T00:00:00Z"), reserveFrom: new Date("2020-03-01T00:00:00Z"), reserveTo: new Date("2020-03-02T00:00:00Z") },
    });
    try {
      const ics = await buildFeed("projects", null);
      expect(ics).toContain(`Feed ${marker}`);
      expect(ics).not.toContain(`Old feed ${marker}`);
    } finally {
      await prisma.project.delete({ where: { id: old.id } });
    }
  });
});
