import { createId } from "@paralleldrive/cuid2";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { logActivity, type ActivityEntity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { getStorage, storageKeyFor } from "@/lib/storage";
import { ATTACHMENT_KINDS, fileConfig, type AttachmentKind } from "../../../config/app.config";

export class FileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileError";
  }
}

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const THUMB_WIDTH = 480;

export type AttachmentDto = {
  id: string;
  kind: AttachmentKind;
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  thumbUrl: string | null;
  createdAt: Date;
  uploaderName: string | null;
};

export const files = {
  /**
   * Store an uploaded file and attach it to an entity.
   * Generates a WebP thumbnail for raster images.
   */
  async upload(
    actor: Actor,
    input: { entityType: ActivityEntity; entityId: string; kind: AttachmentKind; file: File },
  ): Promise<AttachmentDto> {
    assertCan(actor, "files.write");
    const { file } = input;
    if (!file || file.size === 0) throw new FileError("Choose a file.");
    if (file.size > fileConfig.maxUploadBytes) {
      throw new FileError(`File is larger than ${Math.round(fileConfig.maxUploadBytes / 1024 / 1024)} MB.`);
    }
    if (!ATTACHMENT_KINDS.includes(input.kind)) throw new FileError("Unknown attachment kind.");

    const id = createId();
    const storageKey = storageKeyFor(id, file.name);
    const bytes = Buffer.from(await file.arrayBuffer());
    const storage = getStorage();
    await storage.put(storageKey, bytes, file.type || "application/octet-stream");

    let thumbKey: string | null = null;
    if (IMAGE_TYPES.has(file.type)) {
      try {
        const thumb = await sharp(bytes).rotate().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        thumbKey = storageKey.replace(/\.[^.]*$/, "") + ".thumb.webp";
        await storage.put(thumbKey, thumb, "image/webp");
      } catch {
        thumbKey = null; // corrupt image: keep the original, skip the thumbnail
      }
    }

    const row = await prisma.file.create({
      data: { id, name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, storageKey, thumbKey, uploaderId: actor.id },
    });
    const att = await prisma.attachment.create({
      data: { entityType: input.entityType, entityId: input.entityId, fileId: row.id, kind: input.kind },
    });
    await logActivity(actor, {
      entityType: input.entityType,
      entityId: input.entityId,
      action: "attachment_added",
      summary: `Attached ${input.kind} "${file.name}"`,
    });
    return toDto({ ...att, file: { ...row, uploader: { name: actor.name } } });
  },

  async listFor(entityType: ActivityEntity, entityId: string): Promise<AttachmentDto[]> {
    const rows = await prisma.attachment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
      include: { file: { include: { uploader: { select: { name: true } } } } },
    });
    return rows.map(toDto);
  },

  async removeAttachment(actor: Actor, attachmentId: string) {
    assertCan(actor, "files.write");
    const att = await prisma.attachment.findUniqueOrThrow({ where: { id: attachmentId }, include: { file: true } });
    const otherUses = await prisma.attachment.count({ where: { fileId: att.fileId, id: { not: attachmentId } } });
    const usedAsPhoto = await prisma.model.count({ where: { defaultPhotoId: att.fileId } });
    await prisma.attachment.delete({ where: { id: attachmentId } });
    if (otherUses === 0 && usedAsPhoto === 0) {
      const storage = getStorage();
      await prisma.file.delete({ where: { id: att.fileId } });
      await storage.delete(att.file.storageKey);
      if (att.file.thumbKey) await storage.delete(att.file.thumbKey);
    }
    await logActivity(actor, {
      entityType: att.entityType as ActivityEntity,
      entityId: att.entityId,
      action: "attachment_removed",
      summary: `Removed ${att.kind} "${att.file.name}"`,
    });
  },

  /** Metadata + stream for serving. Returns null when the file is unknown. */
  async open(fileId: string, thumb: boolean) {
    const row = await prisma.file.findUnique({ where: { id: fileId } });
    if (!row) return null;
    const key = thumb && row.thumbKey ? row.thumbKey : row.storageKey;
    const storage = getStorage();
    if (!(await storage.exists(key))) return null;
    return {
      name: row.name,
      mimeType: thumb && row.thumbKey ? "image/webp" : row.mimeType,
      size: row.size,
      stream: await storage.stream(key),
    };
  },
};

function toDto(row: {
  id: string;
  kind: string;
  fileId: string;
  createdAt: Date;
  file: { name: string; mimeType: string; size: number; thumbKey: string | null; uploader: { name: string } | null };
}): AttachmentDto {
  return {
    id: row.id,
    kind: row.kind as AttachmentKind,
    fileId: row.fileId,
    name: row.file.name,
    mimeType: row.file.mimeType,
    size: row.file.size,
    url: `/api/files/${row.fileId}`,
    thumbUrl: row.file.thumbKey ? `/api/files/${row.fileId}?thumb=1` : null,
    createdAt: row.createdAt,
    uploaderName: row.file.uploader?.name ?? null,
  };
}
