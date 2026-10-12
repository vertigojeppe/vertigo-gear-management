import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";
// eslint-disable-next-line no-restricted-imports -- service files keep next-auth out of Vitest
import { uploads } from "@/modules/files/uploads";
import { documentKind } from "../logic";
import { documentDetail, documents, documentsForPlan, fileIdsForPlan } from "../documents";
import { renderPlan } from "../plan-pdf";
import { planDetail } from "../queries";
import { plans, schedule } from "../service";

/**
 * Phase 4b: chunked upload → File, document versions, markup layers with
 * authorship, pinning, share-visible file ids, and the plan PDF embedding
 * an image with its markup.
 */
const marker = `doc-${Date.now()}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
const member: Actor = { id: "", email: "", name: "Test Member", role: "member" };
let projectId: string;
let planId: string;
let entryId: string;
let docId: string;
let v1: string;
let v2: string;

async function pushFile(actor: Actor, name: string, bytes: Buffer, mimeType: string) {
  const s = await uploads.start(actor, { name, mimeType, size: bytes.length });
  let offset = 0;
  while (offset < bytes.length) {
    const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + 7)); // tiny chunks exercise the append path
    const r = await uploads.appendChunk(actor, s.id, offset, chunk);
    offset = r.received;
  }
  return uploads.complete(actor, s.id);
}

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  member.id = (await prisma.user.findFirst({ where: { role: "member" } }))?.id ?? admin.id;
  projectId = (await prisma.project.create({ data: { name: `Doc show ${marker}`, status: "confirmed" } })).id;
  planId = (await plans.ensure(admin, projectId)).id;
  entryId = (await schedule.add(admin, planId, { date: "2031-07-01", time: "10:00", durationMin: 60, title: "Rig truss", location: undefined, responsibleId: undefined, notes: undefined })).id;
});

afterAll(async () => {
  for (const d of await prisma.planDocument.findMany({ where: { planId } })) await documents.remove(admin, d.id).catch(() => {});
  await prisma.location.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } });
  await prisma.activityLog.deleteMany({ where: { summary: { contains: marker } } });
  await prisma.$disconnect();
});

describe("document kinds", () => {
  it("picks a viewer by mime type, then extension", () => {
    expect(documentKind("plot.png", "image/png")).toBe("image");
    expect(documentKind("rider.pdf", "application/octet-stream")).toBe("pdf");
    expect(documentKind("rig.glb", "")).toBe("model3d");
    expect(documentKind("venue.skp", "")).toBe("native");
    expect(documentKind("notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("other");
  });
});

describe("uploads and documents", () => {
  it("assembles chunks in order, refuses gaps, and makes a File with a thumbnail", async () => {
    const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#3366cc" } }).png().toBuffer();
    const s = await uploads.start(admin, { name: `plot ${marker}.png`, mimeType: "image/png", size: png.length });
    await expect(uploads.appendChunk(admin, s.id, 5, png.subarray(0, 5))).rejects.toThrow(/Expected offset 0/);
    await expect(uploads.complete(admin, s.id)).rejects.toThrow(/incomplete/);
    await uploads.abandon(admin, s.id);

    const done = await pushFile(admin, `plot ${marker}.png`, png, "image/png");
    const file = await prisma.file.findUniqueOrThrow({ where: { id: done.fileId } });
    expect(file.size).toBe(png.length);
    expect(file.thumbKey).not.toBeNull();
    expect(await getStorage().exists(file.storageKey)).toBe(true);

    const r = await documents.add(admin, planId, { fileId: done.fileId, scheduleEntryId: entryId });
    docId = r.doc.id;
    v1 = r.version.id;
    expect(r.version.version).toBe(1);
  });

  it("the same name becomes version 2 and the old version stays downloadable", async () => {
    const png = await sharp({ create: { width: 80, height: 40, channels: 3, background: "#cc3366" } }).png().toBuffer();
    const done = await pushFile(member, `plot ${marker}.png`, png, "image/png");
    const r = await documents.add(member, planId, { fileId: done.fileId, note: "moved the truss" });
    v2 = r.version.id;
    expect(r.doc.id).toBe(docId);
    expect(r.version.version).toBe(2);
    const detail = await documentDetail(docId);
    expect(detail?.versions.map((x) => x.version)).toEqual([2, 1]);
    expect(detail?.versions[0].note).toBe("moved the truss");
    expect(detail?.versions[1].size).toBeGreaterThan(0);
    expect(detail?.document.scheduleEntryId).toBe(entryId);
    const rows = await documentsForPlan(planId);
    expect(rows[0].pinnedTo).toBe("Rig truss");
    expect([...(await fileIdsForPlan(planId))]).toHaveLength(2);
  });

  it("markup shapes are stamped with their author and kept per page", async () => {
    const mine = [{ id: "a1", type: "rect" as const, points: [0.1, 0.1, 0.5, 0.4], color: "#e11d48" }];
    const saved = await documents.saveMarkup(member, v2, 1, mine);
    const shapes = saved.shapes as { id: string; authorId?: string; authorName?: string; createdAt?: string }[];
    expect(shapes[0]).toMatchObject({ id: "a1", authorId: member.id, authorName: member.name });
    expect(shapes[0].createdAt).toBeTruthy();
    // Admin adds an arrow; the member's rect keeps its author.
    const both = [...(saved.shapes as object[]), { id: "b2", type: "arrow", points: [0.2, 0.2, 0.8, 0.9], color: "#2563eb" }];
    const again = await documents.saveMarkup(admin, v2, 1, both);
    const s2 = again.shapes as { id: string; authorId?: string }[];
    expect(s2.map((s) => [s.id, s.authorId])).toEqual([
      ["a1", member.id],
      ["b2", admin.id],
    ]);
    await expect(documents.saveMarkup(admin, v2, 1, [{ id: "x", type: "rect", points: [5, 5, 6, 6], color: "red" }])).rejects.toThrow(/could not be read/);
    const detail = await documentDetail(docId);
    expect(detail?.versions[0].markups).toEqual([{ page: 1, shapes: expect.arrayContaining([expect.objectContaining({ id: "a1" })]) }]);
    expect(detail?.versions[1].markups).toEqual([]);
  });

  it("the plan PDF embeds the image with its markup, and a day sheet only pinned documents", async () => {
    const detail = (await planDetail(projectId))!;
    const full = await renderPlan(detail);
    expect(full.subarray(0, 4).toString()).toBe("%PDF");
    const empty = await renderPlan(detail, { day: "2031-07-02" });
    expect(full.length).toBeGreaterThan(empty.length + 500);
  });

  it("pinning moves to a task, removing a version keeps the document", async () => {
    const task = await prisma.planTask.create({ data: { planId, phase: "build", title: `Hang ${marker}`, sortOrder: 99 } });
    await documents.pin(admin, docId, { taskId: task.id });
    expect((await documentsForPlan(planId))[0].pinnedTo).toBe(`Hang ${marker}`);
    await documents.removeVersion(admin, v1);
    expect((await documentDetail(docId))?.versions.map((x) => x.version)).toEqual([2]);
    await expect(documents.removeVersion(admin, v2)).rejects.toThrow(/only version/);
    const viewer: Actor = { ...admin, role: "viewer" };
    await expect(documents.saveMarkup(viewer, v2, 1, [])).rejects.toThrow();
  });
});
