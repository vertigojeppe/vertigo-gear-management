import { z } from "zod";
import { optionalDate, optionalId, optionalNumber, optionalText } from "@/lib/forms";

/** One quote / order / invoice line for a model. Prices per unit excl. VAT. */
export const purchaseInput = z.object({
  modelId: z.string().min(1, "Choose a model."),
  supplierContactId: optionalId,
  date: optionalDate,
  reference: optionalText,
  quantity: z.preprocess((v) => (v === "" || v === undefined || v === null ? 1 : Number(v)), z.number().int().min(1).max(100_000)),
  listPrice: optionalNumber,
  discountPct: optionalNumber.refine((v) => v === undefined || (v >= 0 && v <= 100), "Discount is a percentage between 0 and 100."),
  /** Left empty, it is computed from list price and discount. */
  netPrice: optionalNumber,
  notes: optionalText,
});
export type PurchaseInput = z.infer<typeof purchaseInput>;

/** Net per unit when it is not given: list price less the discount, rounded to øre. */
export function netFrom(listPrice: number | undefined | null, discountPct: number | undefined | null, netPrice: number | undefined | null): number | null {
  if (netPrice !== undefined && netPrice !== null) return netPrice;
  if (listPrice === undefined || listPrice === null) return null;
  return Math.round(listPrice * (1 - (discountPct ?? 0) / 100) * 100) / 100;
}
