import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { netFrom, purchaseInput } from "../schema";
import { purchases } from "../service";
import { purchaseList, purchasesForModel } from "../queries";

/**
 * Integration test against the dev/CI database: a purchase record is
 * created with a supplier, edited, listed with its total and removed.
 * Everything carries a unique marker and is deleted afterwards.
 */
const marker = `purch-${Date.now().toString(36)}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
const member: Actor = { id: "", email: "", name: "Test Member", role: "member" };
const viewer: Actor = { id: "", email: "", name: "Test Viewer", role: "viewer" };

let categoryId: string;
let modelId: string;
let supplierId: string;

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  member.id = (await prisma.user.findFirst({ where: { role: "member" } }))?.id ?? admin.id;
  categoryId = (await prisma.category.create({ data: { name: `Cat ${marker}` } })).id;
  modelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Truss ${marker}`, trackingType: "bulk" } })).id;
  supplierId = (await prisma.contact.create({ data: { kind: "company", name: `Supplier ${marker}` } })).id;
});

afterAll(async () => {
  await prisma.purchase.deleteMany({ where: { modelId } });
  await prisma.model.delete({ where: { id: modelId } });
  await prisma.category.delete({ where: { id: categoryId } });
  await prisma.contact.delete({ where: { id: supplierId } });
  await prisma.activityLog.deleteMany({ where: { entityId: modelId } });
  await prisma.$disconnect();
});

const input = (over: Record<string, unknown> = {}) =>
  purchaseInput.parse({ modelId, supplierContactId: supplierId, date: "2025-07-23", reference: "303053885", quantity: "25", listPrice: "3016", discountPct: "40", netPrice: "", notes: "", ...over });

describe("purchases", () => {
  it("works out the net price from list and discount unless given", () => {
    expect(netFrom(3016, 40, undefined)).toBe(1809.6);
    expect(netFrom(100, undefined, undefined)).toBe(100);
    expect(netFrom(100, 40, 55)).toBe(55);
    expect(netFrom(undefined, 40, undefined)).toBeNull();
    expect(purchaseInput.safeParse({ modelId, discountPct: "140" }).success).toBe(false);
    expect(purchaseInput.parse({ modelId }).quantity).toBe(1);
  });

  it("creates, lists, edits and removes a record; viewers may not read it", async () => {
    await expect(purchases.create(viewer, input())).rejects.toThrow();
    await expect(purchases.get(viewer, "x")).rejects.toThrow();
    const p = await purchases.create(member.role === "member" ? admin : admin, input());
    expect(Number(p.netPrice)).toBe(1809.6);
    expect(p.date?.toISOString().slice(0, 10)).toBe("2025-07-23");

    const rows = await purchasesForModel(modelId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ supplierName: `Supplier ${marker}`, date: "2025-07-23", reference: "303053885", quantity: 25, listPrice: 3016, discountPct: 40, netPrice: 1809.6, total: 45240, attachments: 0 });
    expect((await purchaseList()).some((r) => r.id === p.id)).toBe(true);

    await purchases.update(admin, p.id, input({ quantity: "4", netPrice: "1500", modelId: "ignored-on-update" }));
    const edited = await purchases.get(admin, p.id);
    expect(edited).toMatchObject({ modelId, quantity: 4 });
    expect(Number(edited?.netPrice)).toBe(1500);
    expect((await purchasesForModel(modelId))[0].total).toBe(6000);

    await expect(purchases.create(admin, input({ modelId: "nope" }))).rejects.toThrow(/does not exist/);

    const actions = (await prisma.activityLog.findMany({ where: { entityType: "model", entityId: modelId }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["purchase_added", "purchase_updated"]);

    await purchases.remove(admin, p.id);
    expect(await purchasesForModel(modelId)).toHaveLength(0);
  });

  it("goes with the model, but survives the supplier", async () => {
    const m = await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Gone ${marker}`, trackingType: "bulk" } });
    const s = await prisma.contact.create({ data: { kind: "company", name: `Gone supplier ${marker}` } });
    const p = await purchases.create(admin, input({ modelId: m.id, supplierContactId: s.id }));
    await prisma.contact.delete({ where: { id: s.id } });
    expect((await purchases.get(admin, p.id))?.supplierContactId).toBeNull();
    await prisma.model.delete({ where: { id: m.id } });
    expect(await purchases.get(admin, p.id)).toBeNull();
    await prisma.activityLog.deleteMany({ where: { entityId: m.id } });
  });
});
