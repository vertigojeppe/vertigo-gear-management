import { z } from "zod";
import { CUSTOM_FIELD_ENTITIES, CUSTOM_FIELD_TYPES, customFieldKeySchema } from "@/lib/custom-fields";
import { checkbox, optionalNumber, optionalText } from "@/lib/forms";

export const customFieldDefinitionInput = z.object({
  entity: z.enum(CUSTOM_FIELD_ENTITIES),
  key: customFieldKeySchema,
  label: z.string().trim().min(1, "Label is required.").max(80),
  type: z.enum(CUSTOM_FIELD_TYPES),
  /** One option per line for select fields. */
  optionsText: optionalText,
  required: checkbox,
  sortOrder: optionalNumber.transform((v) => v ?? 0),
});
export type CustomFieldDefinitionInput = z.infer<typeof customFieldDefinitionInput>;
