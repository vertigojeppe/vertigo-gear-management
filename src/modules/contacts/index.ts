// Public interface of the contacts module.
export { contacts, ContactError } from "./service";
export { contactInput, contactFilters, CONTACT_KINDS } from "./schema";
export type { ContactInput, ContactKind, ContactFilters } from "./schema";
export { contactList, contactOptions, personOptions, contactDetail } from "./queries";
export type { ContactDetail } from "./queries";
