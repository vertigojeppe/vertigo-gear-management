import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { contactDetail, contactList, contacts } from "@/modules/contacts";
import { contactInput } from "../schema";
import { projects } from "../service";
import { projectDetail } from "../queries";

/**
 * Integration test: project contacts are links to the contact library. A
 * library contact goes on a project with a role, a new person is added to
 * the library on the way, the library finds and counts them, and a contact
 * on a project cannot be deleted.
 */
const marker = `ctlib-${Date.now().toString(36)}`;
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };
let projectId: string;
let venueId: string;

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  projectId = (await prisma.project.create({ data: { name: `Show ${marker}`, status: "confirmed", reserveFrom: new Date("2031-03-01T00:00:00Z"), reserveTo: new Date("2031-03-03T00:00:00Z") } })).id;
  venueId = (await prisma.contact.create({ data: { kind: "person", name: `Venue Vera ${marker}`, organisation: `Hall ${marker}`, phone: "+45 12 34 56 78" } })).id;
});

afterAll(async () => {
  await prisma.project.delete({ where: { id: projectId } });
  const ids = (await prisma.contact.findMany({ where: { name: { contains: marker } }, select: { id: true } })).map((c) => c.id);
  await prisma.activityLog.deleteMany({ where: { OR: [{ entityId: { in: [...ids, projectId] } }, { summary: { contains: marker } }] } });
  await prisma.contact.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

const parse = (over: Record<string, string>) => contactInput.parse({ contactId: "", name: "", organisation: "", phone: "", email: "", role: "", notes: "", ...over });

describe("contact library on projects", () => {
  it("needs a library contact or a name", () => {
    const r = contactInput.safeParse({ contactId: "", name: "  " });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["name"]);
  });

  it("puts a library contact on the project with this job's role, once", async () => {
    await projects.addContact(admin, projectId, parse({ contactId: venueId, role: "Venue tech" }));
    await expect(projects.addContact(admin, projectId, parse({ contactId: venueId }))).rejects.toThrow(/already on this project/);
    const detail = await projectDetail(projectId);
    expect(detail?.contacts).toEqual([expect.objectContaining({ contactId: venueId, name: `Venue Vera ${marker}`, organisation: `Hall ${marker}`, phone: "+45 12 34 56 78", role: "Venue tech" })]);
  });

  it("adds a new person to the library on the way", async () => {
    await projects.addContact(admin, projectId, parse({ name: `Rigger Rasmus ${marker}`, phone: "22 33 44 55", role: "Rigger" }));
    const created = await prisma.contact.findFirstOrThrow({ where: { name: `Rigger Rasmus ${marker}` } });
    expect(created).toMatchObject({ kind: "person", phone: "22 33 44 55" });
    const links = await prisma.projectContact.findMany({ where: { projectId } });
    expect(links.map((l) => l.contactId).sort()).toEqual([venueId, created.id].sort());
  });

  it("finds contacts by organisation or phone, and counts their projects", async () => {
    const byOrg = await contactList({ q: `hall ${marker}` });
    expect(byOrg.rows.map((c) => c.id)).toEqual([venueId]);
    expect(byOrg.rows[0]._count.projects).toBe(1);
    const byPhone = await contactList({ q: `22334455 ${marker}` });
    expect(byPhone.rows.map((c) => c.name)).toEqual([`Rigger Rasmus ${marker}`]);
    expect((await contactList({ q: `Vera ${marker}`, kind: "company" })).rows).toEqual([]);
  });

  it("shows the projects on the contact's page", async () => {
    const d = await contactDetail(venueId);
    expect(d?.projects).toEqual([expect.objectContaining({ projectId, name: `Show ${marker}`, role: "Venue tech", from: "2031-03-01", to: "2031-03-03" })]);
  });

  it("refuses to delete a contact that is on a project; taking it off keeps it in the library", async () => {
    await expect(contacts.remove(admin, venueId)).rejects.toThrow(/on 1 project/);
    const link = await prisma.projectContact.findFirstOrThrow({ where: { projectId, contactId: venueId } });
    await projects.removeContact(admin, link.id);
    expect(await prisma.contact.findUnique({ where: { id: venueId } })).not.toBeNull();
    await contacts.remove(admin, venueId);
    expect(await prisma.contact.findUnique({ where: { id: venueId } })).toBeNull();
  });
});
