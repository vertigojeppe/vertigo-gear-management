// Public interface of the contacts module.
export { contacts, ContactError } from "./service";
export { contactInput, CONTACT_KINDS } from "./schema";
export type { ContactInput, ContactKind } from "./schema";
export { contactList, contactOptions, personOptions } from "./queries";
