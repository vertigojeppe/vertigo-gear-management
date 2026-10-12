import { z } from "zod";
import { CHECK_OUTCOMES, PACKING_GROUPINGS } from "../../../config/app.config";
import { optionalId, optionalNumber, optionalText } from "@/lib/forms";

export const LIST_SOURCES = ["empty", "reservations", "template", "copy"] as const;

export const packingListInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  groupBy: z.enum(PACKING_GROUPINGS).default("category"),
  notes: optionalText,
  /** Only on create. */
  source: z.enum(LIST_SOURCES).default("empty"),
  sourceId: optionalId,
});
export type PackingListInput = z.infer<typeof packingListInput>;

export const lineInput = z.object({
  modelId: z.string().min(1, "Choose a model."),
  quantity: optionalNumber.transform((v) => Math.max(1, Math.round(v ?? 1))),
  note: optionalText,
  caseItemId: optionalId,
});
export type LineInput = z.infer<typeof lineInput>;

export const lineUpdateInput = z.object({
  quantity: optionalNumber.transform((v) => Math.max(1, Math.round(v ?? 1))),
  note: optionalText,
  caseItemId: optionalId,
  itemId: optionalId,
});
export type LineUpdateInput = z.infer<typeof lineUpdateInput>;

export const tickInput = z.object({
  lineId: z.string().min(1),
  /** Serialized: the unit. Bulk: the source bin (optional). */
  itemId: optionalId,
  /** Bulk only. */
  quantity: optionalNumber.transform((v) => (v === undefined ? undefined : Math.max(1, Math.round(v)))),
});
export type TickInput = z.infer<typeof tickInput>;

export const scanInput = z.object({
  tag: z.string().trim().min(1),
});

export const checkInInput = z.object({
  outCheckId: z.string().min(1),
  outcome: z.enum(CHECK_OUTCOMES.map((o) => o.key) as [string, ...string[]]),
  /** Bulk: quantity that came back with this outcome. */
  quantity: optionalNumber.transform((v) => (v === undefined ? undefined : Math.max(1, Math.round(v)))),
  note: optionalText,
});
export type CheckInInput = z.infer<typeof checkInInput>;

export const templateInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  description: optionalText,
});
export type TemplateInput = z.infer<typeof templateInput>;

export const templateLineInput = z.object({
  modelId: z.string().min(1, "Choose a model."),
  quantity: optionalNumber.transform((v) => Math.max(1, Math.round(v ?? 1))),
  note: optionalText,
});
export type TemplateLineInput = z.infer<typeof templateLineInput>;
