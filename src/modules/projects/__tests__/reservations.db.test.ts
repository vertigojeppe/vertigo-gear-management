import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { allocations, allocationsFor, allocationsForModels, ConflictError, projects, clients, modelAvailability } from "../service";
import { projectDetail, timeline } from "../queries";

/** Integration test: reservations across a project and a rental compete for the same units. */
const marker = `res-${Date.now()}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
let categoryId: string;
let modelId: string;
let projectId: string;
let projectBId: string;
let clientId: string;

const projectInput = {
  name: `Project A ${marker}`,
  clientId: undefined,
  venueName: undefined,
  venueAddress: undefined,
  status: "confirmed",
  prepStart: "2030-05-10",
  buildStart: "2030-05-11",
  buildCall: "08:00",
  showStart: "2030-05-12T20:00",
  showEnd: "2030-05-12T23:00",
  packStart: "2030-05-13",
  returnDate: "2030-05-14",
  notes: undefined,
  linksText: undefined,
};

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  categoryId = (await prisma.category.create({ data: { name: `Cat ${marker}` } })).id;
  modelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Mover ${marker}`, trackingType: "serialized" } })).id;
  for (let i = 0; i < 4; i++) {
    await prisma.item.create({ data: { modelId, assetTag: `TST-${marker}-${i}`, status: i === 3 ? "in_repair" : "in_house" } });
  }
  clientId = (await clients.create(admin, { name: `Client ${marker}`, contactName: undefined, email: undefined, phone: undefined, address: undefined, notes: undefined })).id;
  projectId = (await projects.create(admin, projectInput)).id;
  projectBId = (await projects.create(admin, { ...projectInput, name: `Project B ${marker}`, status: "quote" })).id;
});

afterAll(async () => {
  await prisma.outbox.deleteMany({ where: { OR: [{ payload: { path: ["id"], equals: projectId } }, { payload: { path: ["id"], equals: projectBId } }] } });
  await prisma.location.deleteMany({ where: { OR: [{ projectId }, { projectId: projectBId }, { renterId: clientId }] } });
  await prisma.rental.deleteMany({ where: { clientId } });
  await prisma.project.deleteMany({ where: { id: { in: [projectId, projectBId] } } });
  await prisma.client.delete({ where: { id: clientId } });
  await prisma.item.deleteMany({ where: { modelId } });
  await prisma.model.delete({ where: { id: modelId } });
  await prisma.category.delete({ where: { id: categoryId } });
  await prisma.activityLog.deleteMany({ where: { summary: { contains: marker } } });
  await prisma.$disconnect();
});

describe("project creation", () => {
  it("creates nothing when the activity row fails (actor that no longer exists)", async () => {
    const ghost: Actor = { ...admin, id: "ghost-user-id" };
    await expect(projects.create(ghost, { ...projectInput, name: `Ghost ${marker}` })).rejects.toThrow();
    expect(await prisma.project.findFirst({ where: { name: `Ghost ${marker}` } })).toBeNull();
    expect(await prisma.location.findFirst({ where: { name: `Ghost ${marker}` } })).toBeNull();
  });
});

describe("reservations", () => {
  it("derives the reservation window from the phase dates", async () => {
    const p = await projects.get(projectId);
    expect(p?.reserveFrom).toBe("2030-05-10");
    expect(p?.reserveTo).toBe("2030-05-14");
  });

  it("creates a project location", async () => {
    const loc = await prisma.location.findFirst({ where: { projectId } });
    expect(loc?.type).toBe("project");
  });

  it("reserves within availability (3 in service of 4 owned)", async () => {
    const r = await allocations.reserve(admin, projectId, { modelId, quantity: 2, startDate: "2030-05-10", endDate: "2030-05-14", note: undefined, force: false });
    expect(r.check.ok).toBe(true);
    const a = await modelAvailability(modelId, "2030-05-12", "2030-05-12");
    expect(a.owned).toBe(4);
    expect(a.unavailable).toBe(1);
    expect(a.allocated).toBe(2);
    expect(a.available).toBe(1);
  });

  it("refuses an overlapping reservation that does not fit, naming the holder", async () => {
    await expect(allocations.reserve(admin, projectBId, { modelId, quantity: 2, startDate: "2030-05-13", endDate: "2030-05-15", note: undefined, force: false })).rejects.toBeInstanceOf(ConflictError);
    try {
      await allocations.reserve(admin, projectBId, { modelId, quantity: 2, startDate: "2030-05-13", endDate: "2030-05-15", note: undefined, force: false });
    } catch (err) {
      const e = err as ConflictError;
      expect(e.check.shortfall).toBe(1);
      expect(e.check.conflicts[0].holderName).toContain("Project A");
    }
  });

  it("allows it with force and then reports the over-booking", async () => {
    const r = await allocations.reserve(admin, projectBId, { modelId, quantity: 2, startDate: "2030-05-13", endDate: "2030-05-15", note: undefined, force: true });
    expect(r.check.ok).toBe(false);
    const a = await modelAvailability(modelId, "2030-05-13", "2030-05-13");
    expect(a.available).toBe(-1);
  });

  it("does not conflict outside the window", async () => {
    const a = await modelAvailability(modelId, "2030-05-20", "2030-05-21");
    expect(a.available).toBe(3);
  });

  it("moves reservations that follow the project window when dates change", async () => {
    await projects.update(admin, projectId, { ...projectInput, prepStart: "2030-05-09", returnDate: "2030-05-15" });
    const rows = await prisma.allocation.findMany({ where: { projectId } });
    expect(rows[0].startDate.toISOString().slice(0, 10)).toBe("2030-05-09");
    expect(rows[0].endDate.toISOString().slice(0, 10)).toBe("2030-05-15");
  });

  it("queues a calendar sync job when a project is confirmed", async () => {
    const jobs = await prisma.outbox.findMany({ where: { type: "calendar.sync_project", payload: { path: ["id"], equals: projectId } } });
    expect(jobs.length).toBeGreaterThan(0);
  });
});

describe("batched availability", () => {
  it("loads only live allocations that touch the window", async () => {
    const all = await allocationsFor(modelId);
    expect(all.map((a) => a.holderId).sort()).toEqual([projectId, projectBId].sort());
    expect(await allocationsFor(modelId, { from: "2030-06-01" })).toEqual([]);
    expect(await allocationsFor(modelId, { to: "2030-05-08" })).toEqual([]);
    expect((await allocationsFor(modelId, { from: "2030-05-09", to: "2030-05-09" })).map((a) => a.holderId)).toEqual([projectId]);

    await prisma.project.update({ where: { id: projectBId }, data: { status: "done" } });
    try {
      const byModel = await allocationsForModels([modelId, "no-such-model"]);
      expect(byModel.get(modelId)?.map((a) => a.holderId)).toEqual([projectId]);
      expect(byModel.get("no-such-model")).toEqual([]);
    } finally {
      await prisma.project.update({ where: { id: projectBId }, data: { status: "quote" } });
    }
  });

  it("checks every reservation on the project page and flags the model on the calendar", async () => {
    const detail = await projectDetail(projectBId);
    expect(detail?.reservations).toHaveLength(1);
    expect(detail?.reservations[0]).toMatchObject({ shortfall: 1, available: 1 });
    expect(detail?.reservations[0].conflicts.map((c) => c.holderId)).toEqual([projectId]);

    const { conflicts } = await timeline("2030-05-01", "2030-05-31");
    const mine = conflicts.find((c) => c.modelId === modelId);
    expect(mine?.days.map((d) => d.day)).toEqual(["2030-05-13", "2030-05-14", "2030-05-15"]);
    expect(mine?.holders.sort()).toEqual([`Project A ${marker}`, `Project B ${marker}`].sort());
  });
});
