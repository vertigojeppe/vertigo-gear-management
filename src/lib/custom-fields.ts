import { z } from "zod";

/**
 * Custom fields: admins define extra fields per entity; values live in a
 * `customFields` JSON column. This file is pure (no db) so it can be tested.
 */

export const CUSTOM_FIELD_ENTITIES = ["model", "item", "project", "rental"] as const;
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number];

export const CUSTOM_FIELD_TYPES = ["text", "number", "date", "select", "checkbox", "url"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export type CustomFieldDef = {
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  /** Models: shown as a column on each size in the inventory list. */
  showInList?: boolean;
  /** Category the field is limited to (models/items only); null = every category. */
  categoryId?: string | null;
  /** That category plus its sub-categories, resolved by the settings service. */
  categoryIds?: string[] | null;
};

/** Fields that apply to a category: global ones plus those scoped to it or an ancestor. */
export function applicableDefs(defs: CustomFieldDef[], categoryId: string | null | undefined): CustomFieldDef[] {
  return defs.filter((d) => !d.categoryIds || (categoryId ? d.categoryIds.includes(categoryId) : false));
}

export type CustomFieldValues = Record<string, string | number | boolean | null>;

/** Prefix used for custom field inputs in HTML forms: name="cf.<key>". */
export const CF_PREFIX = "cf.";

export const customFieldKeySchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, digits and underscores, starting with a letter.");

export function fieldSchema(def: CustomFieldDef) {
  let s: z.ZodTypeAny;
  switch (def.type) {
    case "number":
      s = z.coerce.number().finite();
      break;
    case "date":
      s = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
      break;
    case "select":
      s = z.string().refine((v) => def.options.includes(v), { message: "Choose one of the options." });
      break;
    case "checkbox":
      // Checkboxes submit "on" or nothing; accept common truthy strings.
      s = z.union([z.boolean(), z.string()]).transform((v) => v === true || v === "on" || v === "true" || v === "1");
      break;
    case "url":
      s = z.string().url("Enter a full URL including https://.");
      break;
    default:
      s = z.string().max(2000);
  }
  return s;
}

/**
 * Build a zod schema for the custom-field values of an entity.
 * Empty strings are treated as "not provided".
 */
export function buildCustomFieldsSchema(defs: CustomFieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const def of defs) {
    const base = fieldSchema(def);
    if (def.type === "checkbox") {
      shape[def.key] = base.optional().transform((v) => v ?? false);
      continue;
    }
    const emptyToUndefined = z.preprocess((v) => (v === "" || v === null ? undefined : v), base.optional());
    shape[def.key] = def.required
      ? emptyToUndefined.refine((v) => v !== undefined, { message: `${def.label} is required.` })
      : emptyToUndefined;
  }
  return z.object(shape);
}

/** Pull `cf.*` entries out of a FormData into a plain object. */
export function customFieldsFromForm(formData: FormData): Record<string, FormDataEntryValue> {
  const out: Record<string, FormDataEntryValue> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith(CF_PREFIX)) out[name.slice(CF_PREFIX.length)] = value;
  }
  return out;
}

/** Validate raw values against definitions; returns values or field errors. */
export function validateCustomFields(
  defs: CustomFieldDef[],
  raw: Record<string, unknown>,
): { ok: true; values: CustomFieldValues } | { ok: false; errors: Record<string, string> } {
  const result = buildCustomFieldsSchema(defs).safeParse(raw);
  if (result.success) {
    const values: CustomFieldValues = {};
    for (const [k, v] of Object.entries(result.data)) {
      if (v !== undefined) values[k] = v as string | number | boolean;
    }
    return { ok: true, values };
  }
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

/** Format a stored value for display. */
export function formatCustomFieldValue(def: CustomFieldDef, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (def.type === "checkbox") return value ? "Yes" : "No";
  return String(value);
}

/** The text of a field in a list cell, or null when the model has no value: "3.500 Lumen", "Throw ratio 1.15–1.5". */
export function listFieldText(def: Pick<CustomFieldDef, "label" | "type">, value: unknown): string | null {
  if (value === null || value === undefined || value === "" || value === false) return null;
  if (def.type === "number" && typeof value === "number") return `${new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 }).format(value)} ${def.label}`;
  if (def.type === "checkbox") return def.label;
  return `${def.label} ${String(value)}`;
}
