import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
// eslint-disable-next-line no-restricted-imports -- the barrel loads server actions, which do not load under Vitest
import { deleteFileIfUnused } from "@/modules/files/uploads";
import type { AppInput, AppVersionInput } from "./schema";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** A tool runs as one self-contained HTML page (scripts and styles inline or from a CDN). */
export const TOOL_MAX_BYTES = 10 * 1024 * 1024;
export function isHtmlFile(f: { name: string; mimeType: string }): boolean {
  return f.mimeType === "text/html" || /\.html?$/i.test(f.name);
}

/**
 * The shared apps list: files to download, links to web tools and small
 * HTML tools that run inside the app. Anyone with apps.write adds apps and
 * versions; only admins (users.manage) delete an app or a version, since
 * an old version is sometimes the one that still works.
 */
export const apps = {
  async create(actor: Actor, input: AppInput) {
    assertCan(actor, "apps.write");
    const app = await prisma.$transaction(async (tx) => {
      const a = await tx.app.create({
        data: { name: input.name, kind: input.kind, category: input.category ?? null, description: input.description ?? null, url: input.kind === "link" ? (input.url ?? null) : null, createdById: actor.id || null },
      });
      await logActivity(actor, { entityType: "app", entityId: a.id, action: "created", summary: `Added ${a.name} to the apps` }, tx);
      return a;
    });
    return app;
  },

  /** Name, category, description and (links) address; the kind stays. */
  async update(actor: Actor, id: string, input: AppInput) {
    assertCan(actor, "apps.write");
    const before = await prisma.app.findUniqueOrThrow({ where: { id } });
    if (before.kind !== input.kind) throw new AppError("The kind of an app cannot change. Add a new app instead.", "kind");
    const app = await prisma.app.update({
      where: { id },
      data: { name: input.name, category: input.category ?? null, description: input.description ?? null, url: before.kind === "link" ? (input.url ?? null) : null },
    });
    await logActivity(actor, { entityType: "app", entityId: id, action: "updated", summary: `Updated ${app.name}` });
    return app;
  },

  async setArchived(actor: Actor, id: string, archived: boolean) {
    assertCan(actor, "apps.write");
    const app = await prisma.app.update({ where: { id }, data: { archived } });
    await logActivity(actor, { entityType: "app", entityId: id, action: archived ? "archived" : "unarchived", summary: `${archived ? "Archived" : "Unarchived"} ${app.name}` });
  },

  /** A new version of a file or tool app from a finished upload. Tools must be one HTML file. */
  async addVersion(actor: Actor, input: AppVersionInput) {
    assertCan(actor, "apps.write");
    const [app, file] = await Promise.all([prisma.app.findUniqueOrThrow({ where: { id: input.appId } }), prisma.file.findUnique({ where: { id: input.fileId } })]);
    if (!file) throw new AppError("The upload was not found. Try again.");
    if (app.kind === "link") throw new AppError("A link has no files.");
    if (app.kind === "tool") {
      if (!isHtmlFile(file)) throw new AppError("A tool is one HTML file (.html) with its scripts inside.");
      if (file.size > TOOL_MAX_BYTES) throw new AppError(`A tool can be at most ${TOOL_MAX_BYTES / 1024 / 1024} MB.`);
    }
    const version = await prisma.$transaction(async (tx) => {
      const v = await tx.appVersion.create({ data: { appId: app.id, fileId: file.id, label: input.label ?? null, notes: input.notes ?? null, uploadedById: actor.id || null } });
      await tx.app.update({ where: { id: app.id }, data: { updatedAt: new Date() } });
      await logActivity(actor, { entityType: "app", entityId: app.id, action: "version_added", summary: `New version of ${app.name}${v.label ? ` (${v.label})` : ""}: ${file.name}` }, tx);
      return v;
    });
    return version;
  },

  /** Admin: delete one version and its file. */
  async removeVersion(actor: Actor, versionId: string) {
    assertCan(actor, "users.manage");
    const v = await prisma.appVersion.delete({ where: { id: versionId }, include: { app: true, file: true } });
    await deleteFileIfUnused(v.fileId);
    await logActivity(actor, { entityType: "app", entityId: v.appId, action: "version_deleted", summary: `Deleted a version of ${v.app.name}${v.label ? ` (${v.label})` : ""}: ${v.file.name}` });
  },

  /** Admin: delete an app with every version and file. */
  async remove(actor: Actor, id: string) {
    assertCan(actor, "users.manage");
    const app = await prisma.app.findUniqueOrThrow({ where: { id }, include: { versions: { select: { fileId: true } } } });
    await prisma.$transaction(async (tx) => {
      await tx.app.delete({ where: { id } });
      await logActivity(actor, { entityType: "app", entityId: id, action: "deleted", summary: `Deleted ${app.name} (${app.versions.length} ${app.versions.length === 1 ? "version" : "versions"})` }, tx);
    });
    for (const v of app.versions) await deleteFileIfUnused(v.fileId);
  },
};
