import type { PrismaClient } from "../../src/generated/prisma/client";

/**
 * People and companies who are not users, plus one "person" location so
 * the "Mikkel has 2" case has somewhere to live.
 */
const CONTACTS = [
  { kind: "company", name: "GearGuys", organisation: null, email: "hello@gearguys.example", phone: "+45 70 10 20 30", address: null, notes: "Partner company. We rent in their Panasonic lenses." },
  { kind: "company", name: "Urs", organisation: null, email: "sales@urs.example", phone: null, address: null, notes: "Truss supplier (quotes 303053885, 302026792)." },
  { kind: "person", name: "Mikkel Meyer", organisation: "Freelance", email: null, phone: "+45 20 30 40 50", address: null, notes: "Borrows stands now and then." },
  { kind: "person", name: "Katharina", organisation: null, email: null, phone: null, address: null, notes: "Has a projector on loan." },
];

export async function seedContacts(prisma: PrismaClient) {
  const ids = new Map<string, string>();
  for (const c of CONTACTS) {
    const existing = await prisma.contact.findFirst({ where: { name: c.name } });
    const row = existing ? await prisma.contact.update({ where: { id: existing.id }, data: c }) : await prisma.contact.create({ data: c });
    ids.set(c.name, row.id);
  }
  // A person location for a contact who holds gear.
  const mikkel = ids.get("Mikkel Meyer")!;
  const loc = await prisma.location.findFirst({ where: { contactId: mikkel } });
  if (!loc) await prisma.location.create({ data: { name: "Mikkel Meyer", type: "person", contactId: mikkel, notes: "Borrowed stands" } });
  return CONTACTS.length;
}
