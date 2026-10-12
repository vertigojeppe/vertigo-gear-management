import { z } from "zod";
import { checkbox, optionalId, optionalNumber, optionalText } from "@/lib/forms";
import { RATE_EXTRA_RULES } from "../../../config/app.config";

const extraRuleKeys = RATE_EXTRA_RULES.map((r) => r.key) as [string, ...string[]];

/** The tiers come as parallel `tierDays` / `tierFactor` fields (see parseTiers in engine.ts). */
export const rateTableInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  isDefault: checkbox,
  extraRule: z.enum(extraRuleKeys),
  extraFactor: optionalNumber.pipe(z.number().min(0).optional()),
  notes: optionalText,
});
export type RateTableInput = z.infer<typeof rateTableInput>;

const percent = optionalNumber.pipe(z.number().min(0, "0–100 %").max(100, "0–100 %").optional());

/** Quote settings on a project or a rental. */
export const quoteSettingsInput = z.object({
  rateTableId: optionalId,
  chargeDays: optionalNumber.transform((v) => (v === undefined ? undefined : Math.round(v))).pipe(z.number().int().min(1, "At least one day.").optional()),
  discountPct: percent,
  terms: optionalText,
});
export type QuoteSettingsInput = z.infer<typeof quoteSettingsInput>;

export const extraLineInput = z.object({
  description: z.string().trim().min(1, "Describe the line.").max(200),
  quantity: optionalNumber.transform((v) => Math.max(1, Math.round(v ?? 1))),
  unitPrice: z.preprocess((v) => (typeof v === "string" ? v.trim().replace(",", ".") : v), z.coerce.number({ message: "Enter a price." }).min(0, "Enter a price.")),
  discountPct: percent,
});
export type ExtraLineInput = z.infer<typeof extraLineInput>;
