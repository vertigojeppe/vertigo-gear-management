import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { files } from "../service";

/** The first photo uploaded to a model becomes its photo; another one can be picked later. */
const M = `photo-${Date.now().toString(36)}`;
const admin: Actor = { id: "", email: "", name: "Alex Admin", role: "admin" };
let modelId = "";

const png = async (name: string, r: number) =>
  new File([new Uint8Array(await sharp({ create: { width: 40, height: 40, channels: 3, background: { r, g: 0, b: 0 } } }).png().toBuffer())], name, { type: "image/png" });
const photoId = async () => (await prisma.model.findUniqueOrThrow({ where: { id: modelId } })).defaultPhotoId;

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  const categoryId = (await prisma.category.findFirstOrThrow()).id;
  modelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Testlight", name: `Photo ${M}` } })).id;
});

afterAll(async () => {
  await prisma.model.deleteMany({ where: { id: modelId } }); // first, so the photo files are no longer in use and go too
  for (const a of await prisma.attachment.findMany({ where: { entityType: "model", entityId: modelId } })) await files.removeAttachment(admin, a.id);
});

describe("model photo", () => {
  it("takes the first uploaded photo, keeps it on the next, and switches when asked", async () => {
    await files.upload(admin, { entityType: "model", entityId: modelId, kind: "manual", file: new File(["x"], "manual.txt", { type: "text/plain" }) });
    expect(await photoId()).toBeNull();
    const first = await files.upload(admin, { entityType: "model", entityId: modelId, kind: "photo", file: await png("front.png", 200) });
    expect(await photoId()).toBe(first.fileId);
    const second = await files.upload(admin, { entityType: "model", entityId: modelId, kind: "photo", file: await png("back.png", 50) });
    expect(await photoId()).toBe(first.fileId);
    await files.setModelPhoto(admin, second.id);
    expect(await photoId()).toBe(second.fileId);
  });
});
