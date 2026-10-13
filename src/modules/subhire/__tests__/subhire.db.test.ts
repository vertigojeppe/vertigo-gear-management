import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { parseLinks, subHireItemInput, subHireLineInput } from "../schema";
import { subHireItems, subHireLines } from "../service";
import { subHireCatalog, subHireLinesFor, subHireOptions } from "../queries";
// eslint-disable-next-line no-restricted-imports -- the quote is where rent-in lines must land; the barrel pulls in server actions
import { quoteFor } from "@/modules/pricing/queries";

/**
 * Integration test against the dev/CI database: a catalog item is created
 * for a partner contact, rented in on a project with the cost and price
 * copied from the catalog, priced on the project's quote, and removed.
 */
const marker = `sh-${Date.now().toString(36)}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
const viewer: Actor = { id: "", email: "", name: "Test Viewer", role: "viewer" };

let ownerId: string;
let projectId: string;
const itemIds: string[] = [];

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  ownerId = (await prisma.contact.create({ data: { kind: "company", name: `Partner ${marker}` } })).id;
  projectId = (await prisma.project.create({ data: { name: `Sub-hire test ${marker}`, status: "quote", reserveFrom: new Date("2033-03-01T00:00:00Z"), reserveTo: new Date("2033-03-03T00:00:00Z") } })).id;
});

afterAll(async () => {
  await prisma.subHireLine.deleteMany({ where: { projectId } });
  await prisma.subHireItem.deleteMany({ where: { OR: [{ id: { in: itemIds } }, { ownerContactId: ownerId }] } });
  await prisma.project.delete({ where: { id: projectId } });
  await prisma.contact.delete({ where: { id: ownerId } });
  await prisma.activityLog.deleteMany({ where: { OR: [{ entityId: { in: [...itemIds, projectId] } }, { entityType: "subhire", summary: { contains: marker } }] } });
  await prisma.$disconnect();
});

describe("sub-hire", () => {
  it("parses links and validates the forms", () => {
    expect(parseLinks("Lens calculator | https://example.test/calc\nhttps://example.test/page\nnot a link")).toEqual([
      { label: "Lens calculator", url: "https://example.test/calc" },
      { label: "example.test", url: "https://example.test/page" },
    ]);
    expect(subHireItemInput.safeParse({ name: "Lens" }).success).toBe(false);
    expect(subHireLineInput.safeParse({ subHireItemId: "x", startDate: "2033-03-03", endDate: "2033-03-01" }).success).toBe(false);
    expect(subHireLineInput.parse({ subHireItemId: "x", startDate: "2033-03-01", endDate: "2033-03-03" }).quantity).toBe(1);
  });

  it("catalog item → rent-in line → quote line, with the catalog prices as defaults", async () => {
    const input = subHireItemInput.parse({ ownerContactId: ownerId, manufacturer: "Panasonic", name: `ET-D3LEW200 ${marker}`, costPerDay: "500", rentalDayPrice: "800", description: "0.7:1", linksText: "Specs | https://example.test/lens" });
    await expect(subHireItems.create(viewer, input)).rejects.toThrow();
    const item = await subHireItems.create(admin, input);
    itemIds.push(item.id);
    expect(item.links).toEqual([{ label: "Specs", url: "https://example.test/lens" }]);

    const groups = await subHireCatalog();
    const group = groups.find((g) => g.ownerContactId === ownerId);
    expect(group?.items.map((i) => i.label)).toEqual([`Panasonic ET-D3LEW200 ${marker}`]);
    expect((await subHireOptions()).find((o) => o.id === item.id)).toMatchObject({ ownerName: `Partner ${marker}`, costPerDay: 500, rentalDayPrice: 800 });

    // Prices left empty on the line come from the catalog item.
    const line = await subHireLines.add(admin, projectId, subHireLineInput.parse({ subHireItemId: item.id, quantity: "2", startDate: "2033-03-01", endDate: "2033-03-03" }));
    expect(Number(line.costPerDay)).toBe(500);
    expect(Number(line.pricePerDay)).toBe(800);
    const rows = await subHireLinesFor(projectId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: `Panasonic ET-D3LEW200 ${marker}`, ownerName: `Partner ${marker}`, quantity: 2, startDate: "2033-03-01", endDate: "2033-03-03" });

    // The quote prices it like our own gear and names the owner; the cost travels along for the internal view.
    const quote = await quoteFor("project", projectId);
    const gear = quote?.gearLines.find((g) => g.id === line.id);
    expect(gear).toMatchObject({ modelId: null, quantity: 2, dayPrice: 800, subHire: { owner: `Partner ${marker}`, costPerDay: 500 } });
    expect(gear?.label).toContain(`rent in from Partner ${marker}`);
    expect(gear!.gross).toBeGreaterThan(0);

    // An item on a project line cannot be deleted, only archived.
    await expect(subHireItems.remove(admin, item.id)).rejects.toThrow(/Archive it instead/);
    await subHireItems.setArchived(admin, item.id, true);
    expect((await subHireOptions()).some((o) => o.id === item.id)).toBe(false);
    expect((await subHireCatalog()).some((g) => g.items.some((i) => i.id === item.id))).toBe(false);
    expect((await subHireCatalog(true)).some((g) => g.items.some((i) => i.id === item.id))).toBe(true);

    await subHireLines.update(admin, line.id, subHireLineInput.parse({ subHireItemId: "ignored", quantity: "3", startDate: "2033-03-01", endDate: "2033-03-02", pricePerDay: "750" }));
    expect((await subHireLinesFor(projectId))[0]).toMatchObject({ subHireItemId: item.id, quantity: 3, pricePerDay: 750 });
    await subHireLines.remove(admin, line.id);
    expect(await subHireLinesFor(projectId)).toHaveLength(0);
    await subHireItems.remove(admin, item.id);
    expect(await subHireItems.get(item.id)).toBeNull();

    const actions = (await prisma.activityLog.findMany({ where: { entityType: "project", entityId: projectId }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["sub_hire_added", "sub_hire_updated", "sub_hire_removed"]);
  });
});
