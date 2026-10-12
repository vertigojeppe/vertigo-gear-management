import { z } from "zod";
import { optionalText } from "@/lib/forms";

export const CONTACT_KINDS = ["person", "company"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

const optionalEmail = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().email("Enter a valid email address.").optional());

export const contactInput = z.object({
  kind: z.enum(CONTACT_KINDS).default("person"),
  name: z.string().trim().min(1, "Name is required.").max(120),
  organisation: optionalText,
  email: optionalEmail,
  phone: optionalText,
  address: optionalText,
  notes: optionalText,
});
export type ContactInput = z.infer<typeof contactInput>;
