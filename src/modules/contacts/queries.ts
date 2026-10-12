import { prisma } from "@/lib/db";

export async function contactList() {
  return prisma.contact.findMany({ orderBy: [{ name: "asc" }], include: { _count: { select: { locations: true } } } });
}

export async function contactOptions() {
  return prisma.contact.findMany({ orderBy: [{ name: "asc" }], select: { id: true, name: true, kind: true, organisation: true } });
}

/** Everyone who can hold gear: active users and contacts. For "person" locations. */
export async function personOptions() {
  const [users, contacts] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.contact.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, organisation: true } }),
  ]);
  return { users, contacts: contacts.map((c) => ({ id: c.id, name: c.organisation ? `${c.name} (${c.organisation})` : c.name })) };
}
