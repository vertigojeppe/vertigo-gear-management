import { createElement } from "react";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { files } from "@/modules/files/service";
import { specLookup } from "../lookup";
import type { Extraction, SpecExtractor } from "../lookup-extract";
import { linkSource, type SpecSource } from "../lookup-source";

/**
 * Spec lookup against the dev database, with a fake source and extractor
 * (no network, no AI): the findings are planned like a one-row spec sheet
 * (empty fields fill, a value already there is kept unless ticked, extra
 * fields by label, the source links appended), ticks decide what is
 * written, the model is stamped as checked, and the page source follows a
 * product page to its datasheet PDF.
 */
const M = `lookup-${Date.now().toString(36)}`;
const admin: Actor = { id: "", email: "", name: "Alex Admin", role: "admin" };
let categoryId = "";
let modelId = "";
let fieldId = "";

const source: SpecSource = {
  kind: "fake",
  async gather() {
    return { documents: [{ url: "https://pro.example.com/rz990", title: "PT-RZ990", kind: "html", text: "Weight 21.7 kg, 9,400 lm" }], links: [{ label: "Product page", url: "https://pro.example.com/rz990" }] };
  },
};
const answer = (over: Partial<Extraction> = {}): SpecExtractor => ({
  name: "Fake",
  async extract() {
    return {
      matchesModel: true,
      product: "PT-RZ990",
      description: "",
      notes: "",
      findings: [
        { field: "weightKg", value: "21.7", evidence: "Weight 21.7 kg" },
        { field: "powerDrawW", value: "620", evidence: "620 W" },
        { field: `x:lumen-${M}`, value: "9,400", evidence: "9,400 lm" },
      ],
      ...over,
    };
  },
});

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  categoryId = (await prisma.category.create({ data: { name: `Projectors ${M}` } })).id;
  fieldId = (await prisma.customFieldDefinition.create({ data: { entity: "model", categoryId, key: `lumen-${M}`, label: `Lumen ${M}`, type: "number" } })).id;
  modelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Testlight", name: `RZ990 ${M}`, powerDrawW: 600 } })).id;
});

afterAll(async () => {
  await prisma.model.deleteMany({ where: { id: modelId } });
  for (const a of await prisma.attachment.findMany({ where: { entityId: modelId } })) await files.removeAttachment(admin, a.id);
  await prisma.activityLog.deleteMany({ where: { entityId: modelId } });
  await prisma.customFieldDefinition.deleteMany({ where: { id: fieldId } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
});

describe("spec lookup", () => {
  it("plans the findings like a spec sheet, with the document's words, and writes nothing", async () => {
    const p = await specLookup.preview(admin, modelId, { url: "https://pro.example.com/rz990" }, { source, extractor: answer() });
    expect(p.plan.changes.map((c) => [c.field, c.action, c.to])).toEqual([
      ["weightKg", "fill", "21.7"],
      ["powerDrawW", "keep", "620"],
      [`lumen-${M}`, "fill", "9400"],
      ["links", "fill", "Product page"],
    ]);
    expect(p.evidence).toMatchObject({ weightKg: "Weight 21.7 kg", [`lumen-${M}`]: "9,400 lm" });
    expect(p.sources).toEqual([{ title: "PT-RZ990", url: "https://pro.example.com/rz990" }]);
    expect((await prisma.model.findUniqueOrThrow({ where: { id: modelId } })).weightKg).toBeNull();
  });

  it("writes only the ticked changes, keeps the power it already had, and stamps the model as checked", async () => {
    const p = await specLookup.preview(admin, modelId, { url: "https://pro.example.com/rz990" }, { source, extractor: answer() });
    const picks = [`${modelId}.weightKg`, `${modelId}.lumen-${M}`, `${modelId}.links`];
    expect(await specLookup.apply(admin, modelId, JSON.parse(JSON.stringify(p.row)), picks, "pro.example.com")).toEqual({ fields: 3, photo: false });
    const m = await prisma.model.findUniqueOrThrow({ where: { id: modelId } });
    expect(Number(m.weightKg)).toBe(21.7);
    expect(m.powerDrawW).toBe(600);
    expect((m.customFields as Record<string, unknown>)[`lumen-${M}`]).toBe(9400);
    expect(m.links).toEqual([{ label: "Product page", url: "https://pro.example.com/rz990" }]);
    expect(m.specsCheckedAt).not.toBeNull();
    const log = await prisma.activityLog.findFirstOrThrow({ where: { entityId: modelId, action: "specs_imported" } });
    expect(log.summary).toBe(`Specs from pro.example.com: filled in weightKg, lumen-${M}, links`);

    // Looked up again, only the declined power is left to decide.
    const again = await specLookup.preview(admin, modelId, { url: "https://pro.example.com/rz990" }, { source, extractor: answer() });
    expect(again.plan.changes.filter((c) => c.action === "fill" || c.action === "keep").map((c) => c.field)).toEqual(["powerDrawW"]);
  });

  it("makes the chosen picture the model's photo, and refuses one that is not an image", async () => {
    const png = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#336699" } }).png().toBuffer();
    const serve = (body: Buffer | string, type: string) => (async () => new Response(typeof body === "string" ? body : new Uint8Array(body), { headers: { "content-type": type } })) as unknown as typeof fetch;
    const p = await specLookup.preview(admin, modelId, {}, { source, extractor: answer({ findings: [] }) });
    await expect(specLookup.apply(admin, modelId, p.row, [], "x", { image: "http://93.184.216.34/page", fetchImpl: serve("<html>not a picture</html>", "image/png") })).rejects.toThrow(/could not be read/);
    expect((await prisma.model.findUniqueOrThrow({ where: { id: modelId } })).defaultPhotoId).toBeNull();

    expect(await specLookup.apply(admin, modelId, p.row, [], "x", { image: "http://93.184.216.34/img/rz990%20front.png?w=800", fetchImpl: serve(png, "application/octet-stream") })).toMatchObject({ photo: true });
    const m = await prisma.model.findUniqueOrThrow({ where: { id: modelId }, include: { defaultPhoto: true } });
    expect(m.defaultPhoto).toMatchObject({ name: "rz990 front.png", mimeType: "image/png" });
    expect(m.defaultPhoto?.thumbKey).not.toBeNull();
  });

  it("says when the documents are about another product, and refuses viewers and a tampered row", async () => {
    const p = await specLookup.preview(admin, modelId, {}, { source, extractor: answer({ matchesModel: false, product: "PT-RZ120" }) });
    expect(p).toMatchObject({ matchesModel: false, product: "PT-RZ120" });
    const viewer: Actor = { ...admin, role: "viewer" };
    await expect(specLookup.preview(viewer, modelId, {}, { source, extractor: answer() })).rejects.toThrow();
    await expect(specLookup.apply(admin, modelId, { ...p.row, id: "someone-else" }, [], "x")).rejects.toThrow(/Look it up again/);
    await expect(specLookup.preview(admin, modelId, {}, { source, extractor: null })).rejects.toThrow(/not set up/);
  });

  it("reads a product page and the datasheet PDF it links to", async () => {
    const pdf = await renderToBuffer(createElement(Document, null, createElement(Page, null, createElement(Text, null, "Datasheet RZ990. Weight: 21.7 kg. Power consumption: 620 W."))));
    const page = `<html><head><title>RZ990</title></head><body><h1>RZ990 laser projector</h1><p>${"Bright and quiet. ".repeat(20)}</p><a href="/docs/rz990-datasheet.pdf">Datasheet (PDF)</a></body></html>`;
    const seen: string[] = [];
    const fake = (async (url: URL | string) => {
      seen.push(String(url));
      return String(url).endsWith(".pdf") ? new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf" } }) : new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
    }) as unknown as typeof fetch;
    // An IP address needs no DNS, so the test stays offline.
    const got = await linkSource(fake).gather({ manufacturer: "Testlight", name: "RZ990", variant: null, url: "http://93.184.216.34/rz990" });
    expect(seen).toEqual(["http://93.184.216.34/rz990", "http://93.184.216.34/docs/rz990-datasheet.pdf"]);
    expect(got.documents.map((d) => d.kind)).toEqual(["html", "pdf"]);
    expect(got.documents[1].text).toContain("Power consumption: 620 W");
    expect(got.links).toEqual([
      { label: "Product page", url: "http://93.184.216.34/rz990" },
      { label: "Datasheet (PDF)", url: "http://93.184.216.34/docs/rz990-datasheet.pdf" },
    ]);
  });
});
