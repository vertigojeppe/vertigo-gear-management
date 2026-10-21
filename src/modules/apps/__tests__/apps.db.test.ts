import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { getStorage, storageKeyFor } from "@/lib/storage";
import { appInput } from "../schema";
import { apps } from "../service";
import { appDetail, appList, toolVersionFile } from "../queries";

/**
 * The shared apps list against the dev/CI database: kinds and their rules,
 * versions (newest first, tools must be HTML), admin-only deletes that
 * remove the files, and the forgiving search.
 */
const marker = `apps${Date.now().toString(36)}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
const member: Actor = { id: "", email: "", name: "Test Member", role: "member" };
const viewer: Actor = { id: "", email: "", name: "Test Viewer", role: "viewer" };
const appIds: string[] = [];

async function file(name: string, mimeType: string, body = "x") {
  const id = createId();
  const storageKey = storageKeyFor(id, name);
  await getStorage().put(storageKey, Buffer.from(body), mimeType);
  return prisma.file.create({ data: { id, name, mimeType, size: Buffer.byteLength(body), storageKey } });
}

beforeAll(async () => {
  admin.id = (await prisma.user.findFirstOrThrow({ where: { role: "admin" } })).id;
  member.id = (await prisma.user.findFirstOrThrow({ where: { role: "member" } })).id;
});

afterAll(async () => {
  const versions = await prisma.appVersion.findMany({ where: { appId: { in: appIds } }, select: { fileId: true } });
  await prisma.app.deleteMany({ where: { id: { in: appIds } } });
  await prisma.file.deleteMany({ where: { id: { in: versions.map((v) => v.fileId) } } });
  await prisma.activityLog.deleteMany({ where: { entityType: "app", entityId: { in: appIds } } });
  await prisma.$disconnect();
});

describe("apps", () => {
  it("validates the form: a link needs an http(s) address", () => {
    expect(appInput.safeParse({ name: "Calc", kind: "link" }).success).toBe(false);
    expect(appInput.safeParse({ name: "Calc", kind: "link", url: "ftp://x" }).success).toBe(false);
    expect(appInput.safeParse({ name: "Calc", kind: "link", url: "https://example.test" }).success).toBe(true);
    expect(appInput.safeParse({ name: "Beyond", kind: "file" }).success).toBe(true);
    expect(appInput.safeParse({ name: "X", kind: "game" }).success).toBe(false);
  });

  it("keeps every version of a file, newest first; only admins delete one, and the file goes with it", async () => {
    await expect(apps.create(viewer, appInput.parse({ name: `Beyond ${marker}`, kind: "file" }))).rejects.toThrow();
    const app = await apps.create(member, appInput.parse({ name: `Beyond ${marker}`, kind: "file", category: "Lasers" }));
    appIds.push(app.id);
    const f1 = await file("BeyondSetup-5.0.exe", "application/octet-stream");
    const f2 = await file("BeyondSetup-5.1.exe", "application/octet-stream");
    await apps.addVersion(member, { appId: app.id, fileId: f1.id, label: "5.0" });
    await new Promise((r) => setTimeout(r, 5));
    const v2 = await apps.addVersion(member, { appId: app.id, fileId: f2.id, label: "5.1", notes: "Fixes FB4 discovery" });
    const detail = await appDetail(app.id);
    expect(detail?.versions.map((v) => v.label)).toEqual(["5.1", "5.0"]);
    expect(detail?.latest?.file.name).toBe("BeyondSetup-5.1.exe");

    await expect(apps.removeVersion(member, v2.id)).rejects.toThrow();
    await apps.removeVersion(admin, v2.id);
    expect(await prisma.file.findUnique({ where: { id: f2.id } })).toBeNull();
    expect((await appDetail(app.id))?.latest?.label).toBe("5.0");
  });

  it("takes only HTML for tools, and serves only tool versions to the runner", async () => {
    const tool = await apps.create(member, appInput.parse({ name: `Throw calc ${marker}`, kind: "tool" }));
    appIds.push(tool.id);
    const exe = await file("calc.exe", "application/octet-stream");
    await expect(apps.addVersion(member, { appId: tool.id, fileId: exe.id })).rejects.toThrow(/HTML/);
    await prisma.file.delete({ where: { id: exe.id } });
    const html = await file("throw-calc.html", "text/html", "<h1>Throw</h1>");
    const v = await apps.addVersion(member, { appId: tool.id, fileId: html.id });
    expect(await toolVersionFile(v.id)).toBe(html.id);

    const beyond = (await appList({ q: `beyond ${marker}` })).rows[0];
    expect(await toolVersionFile(beyond.latest!.id)).toBeNull();
  });

  it("keeps the kind, and links have no files", async () => {
    const link = await apps.create(member, appInput.parse({ name: `Lux calc ${marker}`, kind: "link", url: "https://example.test/lux" }));
    appIds.push(link.id);
    await expect(apps.update(member, link.id, appInput.parse({ name: `Lux calc ${marker}`, kind: "file" }))).rejects.toThrow(/kind/);
    const f = await file("lux.pdf", "application/pdf");
    await expect(apps.addVersion(member, { appId: link.id, fileId: f.id })).rejects.toThrow(/link/);
    await prisma.file.delete({ where: { id: f.id } });
  });

  it("searches forgivingly and hides archived apps unless asked", async () => {
    const found = await appList({ q: `throwcalc ${marker}` });
    expect(found.rows.map((a) => a.name)).toEqual([`Throw calc ${marker}`]);
    expect((await appList({ q: `trhow calc ${marker}` })).closeMatches).toBe(true);
    const tool = found.rows[0];
    await apps.setArchived(member, tool.id, true);
    expect((await appList({ q: `throwcalc ${marker}` })).rows).toHaveLength(0);
    expect((await appList({ q: `throwcalc ${marker}`, archived: true })).rows).toHaveLength(1);
  });

  it("lets only admins delete a whole app, files included", async () => {
    const app = await apps.create(member, appInput.parse({ name: `Old tool ${marker}`, kind: "file" }));
    const f = await file("old.zip", "application/zip");
    await apps.addVersion(member, { appId: app.id, fileId: f.id });
    await expect(apps.remove(member, app.id)).rejects.toThrow();
    await apps.remove(admin, app.id);
    expect(await prisma.app.findUnique({ where: { id: app.id } })).toBeNull();
    expect(await prisma.file.findUnique({ where: { id: f.id } })).toBeNull();
  });
});
