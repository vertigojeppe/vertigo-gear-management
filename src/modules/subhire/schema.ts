import { z } from "zod";
import { checkbox, optionalId, optionalNumber, optionalText } from "@/lib/forms";

/** A catalog item: gear a partner company owns that we rent in. */
export const subHireItemInput = z.object({
  ownerContactId: z.string().min(1, "Choose the company that owns it."),
  manufacturer: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(100).optional()).transform((v) => v ?? ""),
  name: z.string().trim().min(1, "Name is required.").max(150),
  variant: optionalText,
  categoryId: optionalId,
  description: optionalText,
  /** What the owner charges us per day excl. VAT. */
  costPerDay: optionalNumber,
  /** What we charge the client per day (list). */
  rentalDayPrice: optionalNumber,
  /** Textarea: one link per line as "Label | https://..." or just a URL. */
  linksText: optionalText,
  notes: optionalText,
  archived: checkbox,
});
export type SubHireItemInput = z.infer<typeof subHireItemInput>;

/** "Rent in N of this from X" on a project. */
export const subHireLineInput = z
  .object({
    subHireItemId: z.string().min(1, "Choose what to rent in."),
    quantity: optionalNumber.transform((v) => Math.max(1, Math.round(v ?? 1))),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date."),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an end date."),
    costPerDay: optionalNumber,
    pricePerDay: optionalNumber,
    discountPct: optionalNumber.pipe(z.number().min(0, "0–100 %").max(100, "0–100 %").optional()),
    note: optionalText,
  })
  .refine((v) => v.endDate >= v.startDate, { message: "The end date is before the start date.", path: ["endDate"] });
export type SubHireLineInput = z.infer<typeof subHireLineInput>;

export type Link = { label: string; url: string };

/** "Label | https://…" or a bare URL per line → [{ label, url }]. Same rule as model links. */
export function parseLinks(text: string | undefined): Link[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [a, b] = l.split("|").map((s) => s.trim());
      if (b) return { label: a, url: b };
      return { label: a.replace(/^https?:\/\//, "").split("/")[0], url: a };
    })
    .filter((l) => /^https?:\/\//i.test(l.url));
}

export function linksToText(links: Link[]): string {
  return links.map((l) => `${l.label} | ${l.url}`).join("\n");
}
