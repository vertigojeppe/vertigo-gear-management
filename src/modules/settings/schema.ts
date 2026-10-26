import { z } from "zod";
import { CUSTOM_FIELD_ENTITIES, CUSTOM_FIELD_TYPES, customFieldKeySchema } from "@/lib/custom-fields";
import { checkbox, optionalId, optionalNumber, optionalText } from "@/lib/forms";

export const customFieldDefinitionInput = z.object({
  entity: z.enum(CUSTOM_FIELD_ENTITIES),
  /** Models/items only: limit the field to this category and its sub-categories. */
  categoryId: optionalId,
  key: customFieldKeySchema,
  label: z.string().trim().min(1, "Label is required.").max(80),
  type: z.enum(CUSTOM_FIELD_TYPES),
  /** One option per line for select fields. */
  optionsText: optionalText,
  required: checkbox,
  /** Models only: show the value on each size in the inventory list. */
  showInList: checkbox,
  sortOrder: optionalNumber.transform((v) => v ?? 0),
});
export type CustomFieldDefinitionInput = z.infer<typeof customFieldDefinitionInput>;

export const webhookInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  url: z.string().trim().url("Enter a full URL including https://."),
  secret: z.string().trim().min(8, "At least 8 characters.").max(200),
  /** Event keys; empty = all. */
  events: z.preprocess((v) => (Array.isArray(v) ? v : v ? [v] : []), z.array(z.string())),
  active: checkbox,
});
export type WebhookInput = z.infer<typeof webhookInput>;
