import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { wishInput } from "../schema";
import { wishes } from "../service";
import { wishList } from "../queries";

/**
 * Integration test against the dev/CI database: a wish is created,
 * edited, converted (marked bought with the model it became), reopened
 * and removed. Everything carries a unique marker and is deleted after.
 */
const marker = `wish-${Date.now().toString(36)}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
const viewer: Actor = { id: "", email: "", name: "Test Viewer", role: "viewer" };

let categoryId: string;
let modelId: string;
const wishIds: string[] = [];

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  categoryId = (await prisma.category.create({ data: { name: `Cat ${marker}` } })).id;
  modelId = (await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Wished ${marker}`, trackingType: "serialized" } })).id;
});

afterAll(async () => {
  await prisma.wishItem.deleteMany({ where: { OR: [{ id: { in: wishIds } }, { name: { contains: marker } }] } });
  await prisma.model.delete({ where: { id: modelId } });
  await prisma.category.delete({ where: { id: categoryId } });
  await prisma.activityLog.deleteMany({ where: { entityId: { in: [...wishIds, modelId] } } });
  await prisma.$disconnect();
});

const input = (over: Record<string, unknown> = {}) =>
  wishInput.parse({ manufacturer: "Test", name: `Wished ${marker}`, variant: "", categoryId, quantity: "2", price: "1999.5", rentalDayPrice: "150", link: "https://example.test/p", notes: "", ...over });

describe("wishes", () => {
  it("validates the form: name required, link must be a URL, quantity defaults to 1", () => {
    expect(wishInput.safeParse({ name: "" }).success).toBe(false);
    expect(wishInput.safeParse({ name: "Thing", link: "example.test" }).success).toBe(false);
    const ok = wishInput.parse({ name: "Thing", quantity: "" });
    expect(ok.quantity).toBe(1);
    expect(ok.manufacturer).toBe("");
    expect(ok.link).toBeUndefined();
  });

  it("creates, edits, converts, reopens and removes a wish", async () => {
    await expect(wishes.create(viewer, input())).rejects.toThrow();
    const w = await wishes.create(admin, input());
    wishIds.push(w.id);
    expect(w.status).toBe("open");
    expect(Number(w.price)).toBe(1999.5);
    expect(w.createdById).toBe(admin.id);

    const open = await wishList("open");
    expect(open.find((x) => x.id === w.id)).toMatchObject({ categoryName: `Cat ${marker}`, quantity: 2, rentalDayPrice: 150, status: "open", modelId: null });

    await wishes.update(admin, w.id, input({ quantity: "3", link: "" }));
    const edited = await wishes.get(w.id);
    expect(edited?.quantity).toBe(3);
    expect(edited?.link).toBeNull();

    // The model form converted it: bought, and it points at the model.
    await wishes.markBought(admin, w.id, modelId);
    const bought = (await wishList("bought")).find((x) => x.id === w.id);
    expect(bought).toMatchObject({ status: "bought", modelId, modelLabel: `Wished ${marker}` });
    expect((await wishList("open")).some((x) => x.id === w.id)).toBe(false);

    // Reopening by hand keeps the model link; marking bought by hand needs no model.
    await wishes.setStatus(admin, w.id, "open");
    expect(await wishes.get(w.id)).toMatchObject({ status: "open", modelId });
    await wishes.setStatus(admin, w.id, "bought");
    expect((await wishes.get(w.id))?.status).toBe("bought");

    const actions = (await prisma.activityLog.findMany({ where: { entityType: "wish", entityId: w.id }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["created", "updated", "converted", "reopened", "bought"]);
    expect(await prisma.activityLog.count({ where: { entityType: "model", entityId: modelId, action: "created_from_wish" } })).toBe(1);

    await wishes.remove(admin, w.id);
    expect(await wishes.get(w.id)).toBeNull();
  });

  it("deleting the model a wish became keeps the wish", async () => {
    const m = await prisma.model.create({ data: { categoryId, manufacturer: "Test", name: `Gone ${marker}`, trackingType: "serialized" } });
    const w = await wishes.create(admin, input({ name: `Gone ${marker}` }));
    wishIds.push(w.id);
    await wishes.markBought(admin, w.id, m.id);
    await prisma.model.delete({ where: { id: m.id } });
    expect(await wishes.get(w.id)).toMatchObject({ status: "bought", modelId: null });
    await prisma.activityLog.deleteMany({ where: { entityId: m.id } });
  });
});
