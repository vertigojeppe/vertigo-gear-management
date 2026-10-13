import { z } from "zod";
import { optionalId, optionalNumber, optionalText } from "@/lib/forms";

export const WISH_STATUSES = ["open", "bought"] as const;
export type WishStatus = (typeof WISH_STATUSES)[number];

const optionalUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v),
  z
    .string()
    .max(2000)
    .refine((s) => /^https?:\/\//i.test(s), "Enter a full address starting with http:// or https://.")
    .optional(),
);

/** A wish mirrors the model fields so converting it is a straight copy. */
export const wishInput = z.object({
  manufacturer: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(100).optional()).transform((v) => v ?? ""),
  name: z.string().trim().min(1, "Name is required.").max(150),
  variant: optionalText,
  categoryId: optionalId,
  quantity: z.preprocess((v) => (v === "" || v === undefined || v === null ? 1 : Number(v)), z.number().int().min(1).max(10_000)),
  /** Expected purchase price per unit excl. VAT. */
  price: optionalNumber,
  /** Expected rental day price; becomes the model's rentalDayPrice on conversion. */
  rentalDayPrice: optionalNumber,
  link: optionalUrl,
  notes: optionalText,
});
export type WishInput = z.infer<typeof wishInput>;

export const wishStatusInput = z.object({ status: z.enum(WISH_STATUSES) });
