import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import type { ContactInput } from "./schema";

export class ContactError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ContactError";
  }
}

function data(input: ContactInput) {
  return {
    kind: input.kind,
    name: input.name,
    organisation: input.organisation ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    notes: input.notes ?? null,
  };
}

/**
 * People and companies who are not users: borrowers, suppliers, partners,
 * key-fob holders. A contact can hold gear through a location of type
 * "person" that points at it.
 */
export const contacts = {
  async get(id: string) {
    return prisma.contact.findUnique({ where: { id } });
  },

  async create(actor: Actor, input: ContactInput) {
    assertCan(actor, "contacts.write");
    const c = await prisma.contact.create({ data: data(input) });
    await logActivity(actor, { entityType: "contact", entityId: c.id, action: "created", summary: `Created contact ${c.name}` });
    return c;
  },

  async update(actor: Actor, id: string, input: ContactInput) {
    assertCan(actor, "contacts.write");
    const c = await prisma.contact.update({ where: { id }, data: data(input) });
    await logActivity(actor, { entityType: "contact", entityId: c.id, action: "updated", summary: `Updated contact ${c.name}` });
    return c;
  },

  async remove(actor: Actor, id: string) {
    assertCan(actor, "contacts.write");
    const used = await prisma.location.count({ where: { contactId: id } });
    if (used > 0) throw new ContactError("This contact holds gear (it is a location). Delete that location first.");
    const c = await prisma.contact.delete({ where: { id } });
    await logActivity(actor, { entityType: "contact", entityId: id, action: "deleted", summary: `Deleted contact ${c.name}` });
  },
};
