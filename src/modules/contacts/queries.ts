import { prisma } from "@/lib/db";
import { activityFor } from "@/lib/activity";
import { bestMatches } from "@/lib/search";
import { dateToString } from "@/lib/dates";
import { modelLabel } from "@/lib/format";
import type { ContactFilters } from "./schema";

/**
 * The contact library: everyone in it, narrowed by kind and the forgiving
 * search (name, organisation, email, phone, address), with how much each
 * one is used.
 */
export async function contactList(filters: Partial<ContactFilters> = {}) {
  const where = filters.kind ? { kind: filters.kind } : {};
  let closeMatches = false;
  let ids: string[] | undefined;
  if (filters.q) {
    const candidates = await prisma.contact.findMany({ where, select: { id: true, name: true, organisation: true, email: true, phone: true, address: true } });
    const found = bestMatches(candidates, (c) => [c.name, c.organisation, c.email, c.phone, c.address], filters.q);
    ids = found.rows.map((c) => c.id);
    closeMatches = found.close;
  }
  const rows = await prisma.contact.findMany({
    where: { ...where, ...(ids ? { id: { in: ids } } : {}) },
    orderBy: [{ name: "asc" }],
    include: { _count: { select: { locations: true, projects: true, purchases: true, subHireItems: true } } },
  });
  return { rows, closeMatches };
}

/** For pickers (sub-hire owner, supplier, project contacts). */
export async function contactOptions() {
  return prisma.contact.findMany({ orderBy: [{ name: "asc" }], select: { id: true, name: true, kind: true, organisation: true } });
}

/** Everyone who can hold gear: active users and contacts. For "person" locations. */
export async function personOptions() {
  const [users, contacts] = await Promise.all([
    prisma.user.findMany({ where: { active: true, role: { not: "display" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.contact.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, organisation: true } }),
  ]);
  return { users, contacts: contacts.map((c) => ({ id: c.id, name: c.organisation ? `${c.name} (${c.organisation})` : c.name })) };
}

/**
 * One contact and everywhere it is used: the projects it is on (with the
 * job's role, newest first), the gear it holds, the sub-hire items it
 * owns, and, for finance readers, what it supplied.
 */
export async function contactDetail(id: string, opts: { finance?: boolean } = {}) {
  const c = await prisma.contact.findUnique({
    where: { id },
    include: {
      projects: { include: { project: { select: { id: true, name: true, status: true, reserveFrom: true, reserveTo: true } } } },
      locations: { select: { name: true, items: { select: { id: true, assetTag: true, name: true, quantity: true, model: { select: { name: true, variant: true } } }, orderBy: { assetTag: "asc" } } } },
      subHireItems: { orderBy: { name: "asc" }, select: { id: true, manufacturer: true, name: true, variant: true, archived: true } },
    },
  });
  if (!c) return null;
  const [purchases, activity] = await Promise.all([
    opts.finance ? prisma.purchase.findMany({ where: { supplierContactId: id }, orderBy: { date: "desc" }, take: 50, include: { model: { select: { id: true, name: true, variant: true } } } }) : Promise.resolve([]),
    activityFor("contact", id, 30),
  ]);
  const projects = c.projects
    .map((pc) => ({ id: pc.id, projectId: pc.project.id, name: pc.project.name, status: pc.project.status, from: pc.project.reserveFrom ? dateToString(pc.project.reserveFrom) : null, to: pc.project.reserveTo ? dateToString(pc.project.reserveTo) : null, role: pc.role }))
    .sort((a, b) => (b.from ?? "9999").localeCompare(a.from ?? "9999") || a.name.localeCompare(b.name));
  return {
    contact: { id: c.id, kind: c.kind, name: c.name, organisation: c.organisation, email: c.email, phone: c.phone, address: c.address, notes: c.notes },
    projects,
    gear: c.locations.flatMap((l) => l.items.map((i) => ({ id: i.id, assetTag: i.assetTag, label: i.name ?? modelLabel(i.model), quantity: i.quantity, location: l.name }))),
    subHire: c.subHireItems.map((s) => ({ id: s.id, label: modelLabel(s), manufacturer: s.manufacturer, archived: s.archived })),
    purchases: purchases.map((p) => ({ id: p.id, date: p.date ? dateToString(p.date) : null, reference: p.reference, quantity: p.quantity, modelId: p.model.id, modelLabel: modelLabel(p.model) })),
    activity,
  };
}
export type ContactDetail = NonNullable<Awaited<ReturnType<typeof contactDetail>>>;
