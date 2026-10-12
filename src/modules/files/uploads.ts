import { createId } from "@paralleldrive/cuid2";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { getStorage, storageKeyFor } from "@/lib/storage";
import { fileConfig } from "../../../config/app.config";
import { FileError } from "./service";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const THUMB_WIDTH = 480;
const THUMB_MAX_BYTES = 60 * 1024 * 1024;

/**
 * Resumable, chunked uploads. The client starts a session, PUTs chunks in
 * order (each one is small enough to survive a flaky phone connection and
 * can be retried), asks where it got to after a drop, and completes. Only
 * then does a File row exist. Unfinished sessions expire.
 */
export const uploads = {
  async start(actor: Actor, input: { name: string; mimeType: string; size: number }) {
    assertCan(actor, "files.write");
    const name = input.name.trim().slice(0, 200);
    if (!name) throw new FileError("The file needs a name.");
    if (!Number.isInteger(input.size) || input.size <= 0) throw new FileError("Empty file.");
    if (input.size > fileConfig.maxUploadBytes) throw new FileError(`File is larger than ${Math.round(fileConfig.maxUploadBytes / 1024 / 1024)} MB.`);
    await sweepExpired();
    const id = createId();
    const session = await prisma.uploadSession.create({
      data: {
        id,
        uploaderId: actor.id,
        name,
        mimeType: input.mimeType || "application/octet-stream",
        size: input.size,
        chunkSize: fileConfig.chunkBytes,
        partKey: `parts/${id}.part`,
        expiresAt: new Date(Date.now() + fileConfig.uploadSessionHours * 3_600_000),
      },
    });
    return { id: session.id, chunkSize: session.chunkSize, size: session.size };
  },

  async status(actor: Actor, id: string) {
    const s = await own(actor, id);
    return { id: s.id, received: s.received, size: s.size, chunkSize: s.chunkSize };
  },

  async appendChunk(actor: Actor, id: string, offset: number, chunk: Buffer) {
    const s = await own(actor, id);
    if (offset !== s.received) throw new FileError(`Expected offset ${s.received}, got ${offset}.`);
    if (chunk.length === 0) throw new FileError("Empty chunk.");
    if (s.received + chunk.length > s.size) throw new FileError("More bytes than announced.");
    const received = await getStorage().appendPart(s.partKey, offset, chunk);
    await prisma.uploadSession.update({ where: { id }, data: { received } });
    return { received, size: s.size };
  },

  /** Turn the finished part into a File row. */
  async complete(actor: Actor, id: string) {
    const s = await own(actor, id);
    if (s.received !== s.size) throw new FileError(`Upload incomplete: ${s.received} of ${s.size} bytes.`);
    const storage = getStorage();
    const storageKey = storageKeyFor(s.id, s.name);
    await storage.finalizePart(s.partKey, storageKey);
    let thumbKey: string | null = null;
    if (IMAGE_TYPES.has(s.mimeType) && s.size <= THUMB_MAX_BYTES) {
      try {
        const bytes = await storage.get(storageKey);
        const thumb = await sharp(bytes).rotate().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        thumbKey = storageKey.replace(/\.[^.]*$/, "") + ".thumb.webp";
        await storage.put(thumbKey, thumb, "image/webp");
      } catch {
        thumbKey = null;
      }
    }
    const file = await prisma.file.create({ data: { id: s.id, name: s.name, mimeType: s.mimeType, size: s.size, storageKey, thumbKey, uploaderId: actor.id } });
    await prisma.uploadSession.delete({ where: { id } });
    return { fileId: file.id, name: file.name, mimeType: file.mimeType, size: file.size };
  },

  async abandon(actor: Actor, id: string) {
    const s = await own(actor, id);
    await getStorage().delete(s.partKey);
    await prisma.uploadSession.delete({ where: { id } });
  },
};

async function own(actor: Actor, id: string) {
  assertCan(actor, "files.write");
  const s = await prisma.uploadSession.findUnique({ where: { id } });
  if (!s || s.uploaderId !== actor.id) throw new FileError("Upload not found.");
  if (s.expiresAt < new Date()) throw new FileError("Upload expired. Start again.");
  return s;
}

async function sweepExpired() {
  const stale = await prisma.uploadSession.findMany({ where: { expiresAt: { lt: new Date() } }, take: 20 });
  if (stale.length === 0) return;
  const storage = getStorage();
  for (const s of stale) {
    await storage.delete(s.partKey).catch(() => {});
    await prisma.uploadSession.delete({ where: { id: s.id } }).catch(() => {});
  }
}

/** Delete a File row and its bytes when nothing references it any more. */
export async function deleteFileIfUnused(fileId: string) {
  const [attachments, photos, versions, previews] = await Promise.all([
    prisma.attachment.count({ where: { fileId } }),
    prisma.model.count({ where: { defaultPhotoId: fileId } }),
    prisma.planDocumentVersion.count({ where: { fileId } }),
    prisma.planDocument.count({ where: { previewFileId: fileId } }),
  ]);
  if (attachments + photos + versions + previews > 0) return false;
  const row = await prisma.file.findUnique({ where: { id: fileId } });
  if (!row) return false;
  await prisma.file.delete({ where: { id: fileId } });
  const storage = getStorage();
  await storage.delete(row.storageKey);
  if (row.thumbKey) await storage.delete(row.thumbKey);
  return true;
}
