import { z } from "zod";
import { PROJECT_STATUSES } from "../../../config/app.config";
import { checkbox, optionalDate, optionalId, optionalNumber, optionalText } from "@/lib/forms";

const optionalTime = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM.").optional(),
);

const optionalDateTime = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Use the date and time picker.").optional(),
);

export const PROJECT_STATUS_KEYS = PROJECT_STATUSES.map((s) => s.key);

/* Clients */
export const clientInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(150),
  contactName: optionalText,
  email: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().email("Enter a valid email.").optional()),
  phone: optionalText,
  address: optionalText,
  notes: optionalText,
});
export type ClientInput = z.infer<typeof clientInput>;

/* Projects */
export const projectInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(150),
  clientId: optionalId,
  venueName: optionalText,
  venueAddress: optionalText,
  status: z.enum(PROJECT_STATUS_KEYS as [string, ...string[]]).default("quote"),
  /** Day ranges (YYYY-MM-DD, inclusive); one end alone means a single day. */
  prepStart: optionalDate,
  prepEnd: optionalDate,
  buildStart: optionalDate,
  buildEnd: optionalDate,
  /** Call time (HH:MM) for every build-up day. */
  buildCall: optionalTime,
  showStart: optionalDateTime,
  showEnd: optionalDateTime,
  packStart: optionalDate,
  packEnd: optionalDate,
  packCall: optionalTime,
  returnDate: optionalDate,
  notes: optionalText,
  /** One per line: Label | https://url */
  linksText: optionalText,
});
export type ProjectInput = z.infer<typeof projectInput>;

export const projectStatusInput = z.object({
  status: z.enum(PROJECT_STATUS_KEYS as [string, ...string[]]),
});

/**
 * A contact on a project: someone from the library (`contactId`), or a new
 * person (name, organisation, phone, email) who is added to the library on
 * the way. Role and notes belong to this job.
 */
export const contactInput = z
  .object({
    contactId: optionalText,
    name: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(120).optional()),
    organisation: optionalText,
    phone: optionalText,
    email: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().email("Enter a valid email.").optional()),
    role: optionalText,
    notes: optionalText,
  })
  .superRefine((v, ctx) => {
    if (!v.contactId && !v.name) ctx.addIssue({ code: "custom", path: ["name"], message: "Choose a contact or enter a name." });
  });
export type ContactInput = z.infer<typeof contactInput>;

export const crewInput = z.object({
  userId: z.string().min(1, "Choose a person."),
  role: optionalText,
  callTime: optionalDateTime,
  notes: optionalText,
});
export type CrewInput = z.infer<typeof crewInput>;

/* Reservations */
export const allocationInput = z
  .object({
    modelId: z.string().min(1, "Choose a model."),
    quantity: optionalNumber.transform((v) => Math.max(1, Math.round(v ?? 1))),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date."),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an end date."),
    note: optionalText,
    /** Day price for the quote (defaults to the model's list price when left empty on a new reservation) and line discount. */
    pricePerDay: optionalNumber,
    discountPct: optionalNumber.pipe(z.number().min(0, "0–100 %").max(100, "0–100 %").optional()),
    /** "Reserve anyway" after a conflict warning. */
    force: checkbox,
  })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "End date is before the start date." });
export type AllocationInput = z.infer<typeof allocationInput>;

export type Link = { label: string; url: string };

export function parseLinks(text: string | undefined): Link[] {
  if (!text) return [];
  const out: Link[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [a, b] = line.split("|").map((s) => s.trim());
    const url = b ?? a;
    const label = b ? a : a.replace(/^https?:\/\//, "").slice(0, 60);
    if (/^https?:\/\//.test(url)) out.push({ label, url });
  }
  return out;
}

export function linksToText(links: Link[]): string {
  return links.map((l) => `${l.label} | ${l.url}`).join("\n");
}

export const projectFilters = z.object({
  q: optionalText,
  status: optionalText,
  clientId: optionalId,
  /** "upcoming" (default) | "past" | "all" */
  when: z.enum(["upcoming", "past", "all"]).optional().catch(undefined),
  page: optionalNumber.transform((v) => Math.max(1, Math.floor(v ?? 1))),
});
export type ProjectFilters = z.infer<typeof projectFilters>;

export const availabilityQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
