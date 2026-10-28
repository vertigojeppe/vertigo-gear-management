import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getStorage, storageKeyFor } from "@/lib/storage";
import { convertToPdf, type OfficeConverter } from "@/lib/office-convert";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { deleteFileIfUnused } from "@/modules/files/uploads";
import { MARKUP_COLORS } from "../../../config/app.config";
import { convertsToPdf, documentKind, type DocumentKind } from "./logic";
import { PlanError } from "./service";

/* Shapes ----------------------------------------------------------------- */

export const shapeSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(["path", "arrow", "rect", "text"]),
  /** Normalised 0..1 coordinates: x0,y0,x1,y1,... */
  points: z.array(z.number().min(-0.05).max(1.05)).min(2).max(4000),
  text: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default(MARKUP_COLORS[0]),
  authorId: z.string().optional(),
  authorName: z.string().max(120).optional(),
  createdAt: z.string().optional(),
});
export type Shape = z.infer<typeof shapeSchema>;
export const shapesSchema = z.array(shapeSchema).max(500);

/* Services --------------------------------------------------------------- */

async function loadDocument(documentId: string) {
  const doc = await prisma.planDocument.findUnique({ where: { id: documentId }, include: { plan: { include: { project: { select: { id: true, name: true } } } } } });
  if (!doc) throw new PlanError("Document not found.");
  return doc;
}

/**
 * Makes the PDF copy of a Word version and links it (replacing an older
 * copy). False when LibreOffice is missing or cannot read the file; the
 * original stays as it is either way.
 */
async function attachPdf(versionId: string, convert: OfficeConverter): Promise<boolean> {
  const v = await prisma.planDocumentVersion.findUnique({ where: { id: versionId }, include: { file: true } });
  if (!v || !convertsToPdf(v.file.name)) return false;
  const storage = getStorage();
  let pdf: Buffer | null;
  try {
    pdf = await convert(await storage.get(v.file.storageKey), v.file.name);
  } catch {
    pdf = null;
  }
  if (!pdf || pdf.subarray(0, 5).toString() !== "%PDF-") return false;
  const id = createId();
  const name = `${v.file.name.replace(/\.[^.]*$/, "")}.pdf`;
  const storageKey = storageKeyFor(id, name);
  await storage.put(storageKey, pdf, "application/pdf");
  await prisma.file.create({ data: { id, name, mimeType: "application/pdf", size: pdf.length, storageKey, uploaderId: v.file.uploaderId } });
  await prisma.planDocumentVersion.update({ where: { id: versionId }, data: { pdfFileId: id } });
  if (v.pdfFileId) await deleteFileIfUnused(v.pdfFileId);
  return true;
}

export const documents = {
  /**
   * Attach an uploaded file to the plan. The same name on the same plan
   * becomes a new version; the old versions stay downloadable. A Word file
   * also gets its PDF copy (`pdf` says whether that worked).
   */
  async add(actor: Actor, planId: string, input: { fileId: string; name?: string; note?: string; scheduleEntryId?: string | null; taskId?: string | null }, opts: { convert?: OfficeConverter } = {}) {
    assertCan(actor, "plans.write");
    const plan = await prisma.productionPlan.findUnique({ where: { id: planId }, include: { project: { select: { id: true, name: true } } } });
    if (!plan) throw new PlanError("Plan not found.");
    const file = await prisma.file.findUnique({ where: { id: input.fileId } });
    if (!file) throw new PlanError("Upload not found.");
    const name = (input.name ?? file.name).trim().slice(0, 200) || file.name;
    const result = await prisma.$transaction(async (tx) => {
      let doc = await tx.planDocument.findUnique({ where: { planId_name: { planId, name } } });
      if (!doc) {
        doc = await tx.planDocument.create({ data: { planId, name, scheduleEntryId: input.scheduleEntryId ?? null, taskId: input.taskId ?? null } });
      } else if (input.scheduleEntryId !== undefined || input.taskId !== undefined) {
        doc = await tx.planDocument.update({ where: { id: doc.id }, data: { scheduleEntryId: input.scheduleEntryId ?? doc.scheduleEntryId, taskId: input.taskId ?? doc.taskId } });
      }
      const last = await tx.planDocumentVersion.findFirst({ where: { documentId: doc.id }, orderBy: { version: "desc" } });
      const version = await tx.planDocumentVersion.create({ data: { documentId: doc.id, version: (last?.version ?? 0) + 1, fileId: file.id, note: input.note ?? null } });
      return { doc, version };
    });
    await logActivity(actor, { entityType: "project", entityId: plan.project.id, action: "document_added", summary: `${plan.project.name}: ${result.version.version === 1 ? "added document" : `new version ${result.version.version} of`} "${name}"` });
    const pdf = convertsToPdf(file.name) ? await attachPdf(result.version.id, opts.convert ?? convertToPdf) : null;
    return { ...result, pdf };
  },

  /** (Re)make the PDF copy of a Word version, e.g. one added before LibreOffice was there. */
  async makePdf(actor: Actor, versionId: string, opts: { convert?: OfficeConverter } = {}) {
    assertCan(actor, "plans.write");
    const v = await prisma.planDocumentVersion.findUnique({ where: { id: versionId }, include: { file: { select: { name: true } } } });
    if (!v) throw new PlanError("Document not found.");
    if (!convertsToPdf(v.file.name)) throw new PlanError("Only Word files are turned into PDFs.");
    if (!(await attachPdf(versionId, opts.convert ?? convertToPdf))) throw new PlanError("Could not make a PDF of this file. Download the original instead.");
  },

  async remove(actor: Actor, documentId: string) {
    assertCan(actor, "plans.write");
    const doc = await loadDocument(documentId);
    const versions = await prisma.planDocumentVersion.findMany({ where: { documentId }, select: { fileId: true, pdfFileId: true } });
    await prisma.planDocument.delete({ where: { id: documentId } });
    for (const v of versions) {
      await deleteFileIfUnused(v.fileId);
      if (v.pdfFileId) await deleteFileIfUnused(v.pdfFileId);
    }
    if (doc.previewFileId) await deleteFileIfUnused(doc.previewFileId);
    await logActivity(actor, { entityType: "project", entityId: doc.plan.project.id, action: "document_removed", summary: `${doc.plan.project.name}: removed document "${doc.name}"` });
  },

  async removeVersion(actor: Actor, versionId: string) {
    assertCan(actor, "plans.write");
    const v = await prisma.planDocumentVersion.findUniqueOrThrow({ where: { id: versionId }, include: { document: { include: { plan: { include: { project: { select: { id: true, name: true } } } } } } } });
    const count = await prisma.planDocumentVersion.count({ where: { documentId: v.documentId } });
    if (count <= 1) throw new PlanError("Delete the document instead of its only version.");
    await prisma.planDocumentVersion.delete({ where: { id: versionId } });
    await deleteFileIfUnused(v.fileId);
    if (v.pdfFileId) await deleteFileIfUnused(v.pdfFileId);
    await logActivity(actor, { entityType: "project", entityId: v.document.plan.project.id, action: "document_version_removed", summary: `${v.document.plan.project.name}: removed version ${v.version} of "${v.document.name}"` });
  },

  /** Pin to a schedule entry or a task (or neither). */
  async pin(actor: Actor, documentId: string, target: { scheduleEntryId?: string | null; taskId?: string | null }) {
    assertCan(actor, "plans.write");
    const doc = await loadDocument(documentId);
    const scheduleEntryId = target.scheduleEntryId ?? null;
    const taskId = scheduleEntryId ? null : (target.taskId ?? null);
    if (scheduleEntryId && !(await prisma.scheduleEntry.findFirst({ where: { id: scheduleEntryId, planId: doc.planId } }))) throw new PlanError("That schedule entry is not on this plan.");
    if (taskId && !(await prisma.planTask.findFirst({ where: { id: taskId, planId: doc.planId } }))) throw new PlanError("That task is not on this plan.");
    const updated = await prisma.planDocument.update({ where: { id: documentId }, data: { scheduleEntryId, taskId } });
    await logActivity(actor, { entityType: "project", entityId: doc.plan.project.id, action: "document_pinned", summary: `${doc.plan.project.name}: pinned "${doc.name}"` });
    return updated;
  },

  /** A user-uploaded preview image for formats without a viewer. */
  async setPreview(actor: Actor, documentId: string, fileId: string | null) {
    assertCan(actor, "plans.write");
    const doc = await loadDocument(documentId);
    if (fileId) {
      const file = await prisma.file.findUnique({ where: { id: fileId } });
      if (!file || !file.mimeType.startsWith("image/")) throw new PlanError("The preview must be an image.");
    }
    const old = doc.previewFileId;
    const updated = await prisma.planDocument.update({ where: { id: documentId }, data: { previewFileId: fileId } });
    if (old && old !== fileId) await deleteFileIfUnused(old);
    return updated;
  },

  /**
   * Replace the markup layer of one page. New shapes (no author yet) are
   * stamped with the actor; existing shapes keep theirs.
   */
  async saveMarkup(actor: Actor, versionId: string, page: number, rawShapes: unknown) {
    assertCan(actor, "plans.write");
    const v = await prisma.planDocumentVersion.findUniqueOrThrow({ where: { id: versionId }, include: { document: { include: { plan: { include: { project: { select: { id: true, name: true } } } } } } } });
    const parsed = shapesSchema.safeParse(rawShapes);
    if (!parsed.success) throw new PlanError("Markup could not be read.");
    const now = new Date().toISOString();
    const shapes: Shape[] = parsed.data.map((s) => ({ ...s, authorId: s.authorId ?? actor.id, authorName: s.authorName ?? actor.name, createdAt: s.createdAt ?? now }));
    const row = await prisma.markup.upsert({
      where: { versionId_page: { versionId, page } },
      create: { versionId, page, shapes, updatedById: actor.id },
      update: { shapes, updatedById: actor.id },
    });
    await logActivity(actor, { entityType: "project", entityId: v.document.plan.project.id, action: "markup_saved", summary: `${v.document.plan.project.name}: markup on "${v.document.name}" page ${page} (${shapes.length} shapes)` });
    return row;
  },
};

/* Queries ---------------------------------------------------------------- */

export type DocumentVersionRow = {
  id: string;
  version: number;
  /** How this version is shown: a Word file with its PDF copy is a "pdf". */
  kind: DocumentKind;
  fileId: string;
  /** The original file (download). */
  url: string;
  /** The PDF copy of a Word file, if made. */
  pdfFileId: string | null;
  pdfUrl: string | null;
  /** What the viewer, markup and plan PDF use: the PDF copy, else the original. */
  viewUrl: string;
  /** A Word file (has or could have a PDF copy). */
  convertible: boolean;
  thumbUrl: string | null;
  name: string;
  mimeType: string;
  size: number;
  note: string | null;
  uploaderName: string | null;
  createdAt: Date;
  markups: { page: number; shapes: Shape[] }[];
};

export type DocumentRow = {
  id: string;
  name: string;
  kind: DocumentKind;
  scheduleEntryId: string | null;
  taskId: string | null;
  pinnedTo: string | null;
  previewFileId: string | null;
  previewUrl: string | null;
  latest: DocumentVersionRow;
  versions: DocumentVersionRow[];
  createdAt: Date;
};

const versionInclude = { file: { include: { uploader: { select: { name: true } } } }, markups: { orderBy: { page: "asc" as const } } };

function toVersion(v: { id: string; version: number; fileId: string; pdfFileId: string | null; note: string | null; createdAt: Date; file: { name: string; mimeType: string; size: number; thumbKey: string | null; uploader: { name: string } | null }; markups: { page: number; shapes: unknown }[] }): DocumentVersionRow {
  const pdfUrl = v.pdfFileId ? `/api/files/${v.pdfFileId}` : null;
  return {
    id: v.id,
    version: v.version,
    kind: v.pdfFileId ? "pdf" : documentKind(v.file.name, v.file.mimeType),
    fileId: v.fileId,
    url: `/api/files/${v.fileId}`,
    pdfFileId: v.pdfFileId,
    pdfUrl,
    viewUrl: pdfUrl ?? `/api/files/${v.fileId}`,
    convertible: convertsToPdf(v.file.name),
    thumbUrl: v.file.thumbKey ? `/api/files/${v.fileId}?thumb=1` : null,
    name: v.file.name,
    mimeType: v.file.mimeType,
    size: v.file.size,
    note: v.note,
    uploaderName: v.file.uploader?.name ?? null,
    createdAt: v.createdAt,
    markups: v.markups.map((m) => ({ page: m.page, shapes: shapesSchema.safeParse(m.shapes).success ? (m.shapes as Shape[]) : [] })),
  };
}

export async function documentsForPlan(planId: string): Promise<DocumentRow[]> {
  const rows = await prisma.planDocument.findMany({
    where: { planId },
    orderBy: { name: "asc" },
    include: { versions: { orderBy: { version: "desc" }, include: versionInclude }, scheduleEntry: { select: { title: true } }, task: { select: { title: true } } },
  });
  return rows
    .filter((d) => d.versions.length > 0)
    .map((d) => {
      const versions = d.versions.map(toVersion);
      return {
        id: d.id,
        name: d.name,
        kind: versions[0].kind,
        scheduleEntryId: d.scheduleEntryId,
        taskId: d.taskId,
        pinnedTo: d.scheduleEntry?.title ?? d.task?.title ?? null,
        previewFileId: d.previewFileId,
        previewUrl: d.previewFileId ? `/api/files/${d.previewFileId}` : null,
        latest: versions[0],
        versions,
        createdAt: d.createdAt,
      };
    });
}

export async function documentDetail(documentId: string) {
  const d = await prisma.planDocument.findUnique({
    where: { id: documentId },
    include: {
      plan: { include: { project: { select: { id: true, name: true } }, schedule: { orderBy: { startsAt: "asc" }, select: { id: true, title: true, startsAt: true } }, tasks: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true } } } },
      versions: { orderBy: { version: "desc" }, include: versionInclude },
    },
  });
  if (!d || d.versions.length === 0) return null;
  const versions = d.versions.map(toVersion);
  return {
    document: { id: d.id, name: d.name, kind: versions[0].kind, scheduleEntryId: d.scheduleEntryId, taskId: d.taskId, previewFileId: d.previewFileId, previewUrl: d.previewFileId ? `/api/files/${d.previewFileId}` : null },
    plan: { id: d.plan.id, projectId: d.plan.project.id, projectName: d.plan.project.name },
    scheduleEntries: d.plan.schedule,
    tasks: d.plan.tasks,
    versions,
  };
}

/** Every file a plan's share link may serve: all versions and preview images. */
export async function fileIdsForPlan(planId: string): Promise<Set<string>> {
  const docs = await prisma.planDocument.findMany({ where: { planId }, select: { previewFileId: true, versions: { select: { fileId: true, pdfFileId: true } } } });
  const ids = new Set<string>();
  for (const d of docs) {
    if (d.previewFileId) ids.add(d.previewFileId);
    for (const v of d.versions) {
      ids.add(v.fileId);
      if (v.pdfFileId) ids.add(v.pdfFileId);
    }
  }
  return ids;
}
