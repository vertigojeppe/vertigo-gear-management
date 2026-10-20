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

  it("renders project phases as VEVENTs with a link back", async () => {
    const ics = await buildFeed("projects", null);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain(`SUMMARY:Feed ${marker} – build-up (call 08:00)`);
    // One all-day event over the three build-up days (end exclusive).
    const build = ics.split("BEGIN:VEVENT").find((e) => e.includes(`${projectId}-load_in@`))!;
    expect(build).toMatch(/DTSTART;VALUE=DATE:20300629/);
    expect(build).toMatch(/DTEND;VALUE=DATE:20300702/);
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
