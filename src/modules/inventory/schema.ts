import { z } from "zod";
import { isColorKey } from "@/lib/colors";
import { CONSUMABLE_UNITS } from "./consumables-logic";
import { ITEM_STATUS_KEYS, LOCATION_TYPES, RETIREMENT_REASONS } from "../../../config/app.config";
import { checkbox, decimal, optionalDate, optionalId, optionalNumber, optionalText } from "@/lib/forms";
import { ITEM_SORTS, MODEL_SORTS } from "./sorting";

/* Categories */
export const categoryInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  parentId: optionalId,
  sortOrder: optionalNumber.transform((v) => v ?? 0),
});
export type CategoryInput = z.infer<typeof categoryInput>;

/** One row of the tape-colour table: length in metres and a palette key. */
export const lengthColorInput = z.object({
  metres: decimal(z.coerce.number().positive("Enter the length in metres.").max(1000)),
  color: z.string().refine(isColorKey, "Pick a colour."),
});
export type LengthColorInput = z.infer<typeof lengthColorInput>;

/* Locations */
export const locationInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  type: z.enum(LOCATION_TYPES),
  parentId: optionalId,
  notes: optionalText,
  /** type = person: "user:<id>" or "contact:<id>". */
  person: optionalText,
});
export type LocationInput = z.infer<typeof locationInput>;

/* Models */
export const TRACKING_TYPES = ["serialized", "bulk"] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];

export const linkSchema = z.object({ label: z.string().trim().min(1).max(100), url: z.string().url() });

export const modelInput = z.object({
  categoryId: z.string().min(1, "Choose a category."),
  /** Empty for own-built gear (BlackLED, SplitLED, cases): the label is then just the name. */
  manufacturer: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(100).optional()).transform((v) => v ?? ""),
  name: z.string().trim().min(1, "Model name is required.").max(150),
  /** Size within the family ("5 m", "150 cm"); one model per variant. */
  variant: optionalText,
  trackingType: z.enum(TRACKING_TYPES),
  description: optionalText,
  weightKg: optionalNumber,
  widthCm: optionalNumber,
  heightCm: optionalNumber,
  depthCm: optionalNumber,
  powerDrawW: optionalNumber.transform((v) => (v === undefined ? undefined : Math.round(v))),
  /** List rental price per day excl. VAT; the pricing engine multiplies it by the rate-table factor. */
  rentalDayPrice: optionalNumber,
  notes: optionalText,
  /** Textarea: one link per line as "Label | https://..." or just a URL. */
  linksText: optionalText,
  /** Own projects only; never on a rental. */
  notForRental: checkbox,
  /** Used up rather than returned (lamps, LED strip, alu profile). */
  consumable: checkbox,
  /** "pcs" or "m"; metres keep their stock in the ledger. Only meaningful for consumables. */
  unit: z.preprocess((v) => (v === "" || v === undefined || v === null ? "pcs" : v), z.enum(CONSUMABLE_UNITS)),
  /** Running low below this, in the model's unit. */
  minStock: optionalNumber.pipe(z.number().min(0, "Cannot be negative.").optional()),
});
export type ModelInput = z.infer<typeof modelInput>;

/** "Used 2 m" / "used 1 lamp in VG-0123 on Roskilde". */
export const consumableUseInput = z.object({
  modelId: z.string().min(1),
  quantity: decimal(z.coerce.number({ message: "Enter a quantity." }).positive("Enter a quantity above zero.").max(100_000)),
  /** Asset tag of the unit it went into. */
  itemTag: optionalText,
  projectId: optionalId,
  note: optionalText,
});
export type ConsumableUseInput = z.infer<typeof consumableUseInput>;

export const consumableReceiveInput = z.object({
  modelId: z.string().min(1),
  quantity: decimal(z.coerce.number({ message: "Enter a quantity." }).positive("Enter a quantity above zero.").max(100_000)),
  note: optionalText,
});
export type ConsumableReceiveInput = z.infer<typeof consumableReceiveInput>;

export const consumableCountInput = z.object({
  modelId: z.string().min(1),
  quantity: decimal(z.coerce.number({ message: "Enter what is on the shelf." }).min(0, "Cannot be negative.").max(100_000)),
  note: optionalText,
});
export type ConsumableCountInput = z.infer<typeof consumableCountInput>;

/** A part fits a model: bring 1 per `perUnits` units, at least `minQty`. */
export const partFitInput = z.object({
  modelId: z.string().min(1, "Choose the model it fits."),
  perUnits: z.coerce.number().int().min(1, "At least 1.").max(100).default(4),
  minQty: z.coerce.number().int().min(0).max(100).default(1),
});
export type PartFitInput = z.infer<typeof partFitInput>;

/** Admin: rename a whole family; every model sharing the old manufacturer + name follows. */
/** "yes" / "no" set a flag on every variant; anything else ("" = mixed) leaves each as it is. */
const familyFlag = z.preprocess((v) => (v === "yes" ? true : v === "no" ? false : undefined), z.boolean().optional());

export const familyEditInput = z.object({
  /** Undefined = leave each variant's manufacturer as it is (the action sends that for an empty field over mixed manufacturers). */
  manufacturer: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(100).optional()),
  name: z.string().trim().min(1, "Model name is required.").max(150),
  /** Empty = leave each variant in its own category. */
  categoryId: optionalId,
  notForRental: familyFlag,
  archived: familyFlag,
  consumable: familyFlag,
});
export type FamilyEditInput = z.infer<typeof familyEditInput>;

export function parseLinksText(text: string | undefined): { label: string; url: string }[] {
  if (!text) return [];
  const out: { label: string; url: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [a, b] = line.split("|").map((s) => s.trim());
    const url = b ?? a;
    const label = b ? a : a.replace(/^https?:\/\//, "").slice(0, 60);
    const parsed = linkSchema.safeParse({ label, url });
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export function linksToText(links: { label: string; url: string }[]): string {
  return links.map((l) => `${l.label} | ${l.url}`).join("\n");
}

/* Items */
export const itemInput = z.object({
  modelId: z.string().min(1, "Choose a model."),
  serialNumber: optionalText,
  quantity: optionalNumber.transform((v) => (v === undefined ? 1 : Math.round(v))).pipe(z.number().int().min(0)),
  locationId: optionalId,
  isKit: checkbox,
  name: optionalText,
  purchaseDate: optionalDate,
  purchasePrice: optionalNumber,
  supplier: optionalText,
  insuredValue: optionalNumber,
  replacementValue: optionalNumber,
  conditionNotes: optionalText,
  notes: optionalText,
  notForRental: checkbox,
});
export type ItemInput = z.infer<typeof itemInput>;

/** "Add several units at once" for serialized models. */
export const itemBatchInput = itemInput.extend({
  count: optionalNumber.transform((v) => (v === undefined ? 1 : Math.round(v))).pipe(z.number().int().min(1).max(200)),
  /** Optional newline-separated serial numbers, one per unit. */
  serialNumbers: optionalText,
});

/** Location in a status change: undefined = keep, null = clear, id = move. */
const keepOrLocation = z.preprocess(
  (v) => (v === "" || v === "__keep__" || v === undefined ? undefined : v === "__none__" ? null : v),
  z.string().min(1).nullable().optional(),
);

export const statusChangeInput = z.object({
  status: z.enum(ITEM_STATUS_KEYS as [string, ...string[]]),
  reason: optionalText,
  locationId: keepOrLocation,
  /** Required when status = retired. */
  retiredReason: z.preprocess((v) => (v === "" ? undefined : v), z.enum(RETIREMENT_REASONS).optional()),
});
export type StatusChangeInput = z.infer<typeof statusChangeInput>;

export const moveInput = z.object({
  locationId: optionalId,
});

/* List filters (from search params) */
export const itemFilters = z.object({
  q: optionalText,
  status: optionalText,
  locationId: optionalId,
  categoryId: optionalId,
  modelId: optionalId,
  kits: z.preprocess((v) => v === "1" || v === "true", z.boolean()).optional(),
  sort: z.enum(ITEM_SORTS).optional().catch(undefined),
  page: optionalNumber.transform((v) => Math.max(1, Math.floor(v ?? 1))),
});
export type ItemFilters = z.infer<typeof itemFilters>;

export const modelFilters = z.object({
  q: optionalText,
  categoryId: optionalId,
  trackingType: z.enum(TRACKING_TYPES).optional().catch(undefined),
  archived: z.preprocess((v) => v === "1" || v === "true", z.boolean()).optional(),
  sort: z.enum(MODEL_SORTS).optional().catch(undefined),
  page: optionalNumber.transform((v) => Math.max(1, Math.floor(v ?? 1))),
});
export type ModelFilters = z.infer<typeof modelFilters>;
