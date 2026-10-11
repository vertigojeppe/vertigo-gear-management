import { z } from "zod";
import { checkbox, optionalId, optionalNumber, optionalText } from "@/lib/forms";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");

export const rentalInput = z
  .object({
    clientId: z.string().min(1, "Choose a client."),
    startDate: dateString,
    endDate: dateString,
    deposit: optionalNumber,
    notes: optionalText,
  })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "End date is before the start date." });
export type RentalInput = z.infer<typeof rentalInput>;

export const rentalLineInput = z.object({
  modelId: z.string().min(1, "Choose a model."),
  quantity: optionalNumber.transform((v) => Math.max(1, Math.round(v ?? 1))),
  pricePerDay: optionalNumber,
  pricePerWeek: optionalNumber,
  note: optionalText,
  force: checkbox,
});
export type RentalLineInput = z.infer<typeof rentalLineInput>;

export const assignItemInput = z.object({
  itemId: optionalId,
});

export const rentalFilters = z.object({
  q: optionalText,
  status: optionalText,
  page: optionalNumber.transform((v) => Math.max(1, Math.floor(v ?? 1))),
});
export type RentalFilters = z.infer<typeof rentalFilters>;
