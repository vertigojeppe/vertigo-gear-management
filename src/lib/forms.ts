import { z } from "zod";

/**
 * Shared shape for server-action results consumed by useActionState.
 * `fieldErrors` keys match input names; `error` is a form-level message.
 */
export type FormState<T = undefined> = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Echo of submitted values so forms can re-render them on error. */
  values?: Record<string, string>;
  data?: T;
};

/** Convert FormData to a plain object (last value wins; `[]` names become arrays). */
export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$")) continue; // framework internals
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      if (Array.isArray(out[k])) (out[k] as unknown[]).push(value);
      else out[k] = [value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Echo string values of a FormData so forms can re-populate after an error. */
export function echoValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) out[key] = value;
  }
  return out;
}

/** Map zod issues to { field: message }. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/** Parse FormData with a zod schema; returns data or a FormState with errors. */
export function parseForm<S extends z.ZodTypeAny>(
  schema: S,
  formData: FormData,
): { ok: true; data: z.infer<S> } | { ok: false; state: FormState<never> } {
  const result = schema.safeParse(formToObject(formData));
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, state: { ok: false, fieldErrors: zodFieldErrors(result.error), values: echoValues(formData) } };
}

/* Reusable zod pieces for form inputs (strings from FormData). */

/** Optional text: "" becomes undefined. */
export const optionalText = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(5000).optional());

/**
 * A typed number as JavaScript reads it: "12,5" and "12.5" are both 12.5,
 * spaces go, and with both marks the last one is the decimal point
 * ("1.234,50" and "1,234.50" are 1234.5). Anything else passes through.
 */
export function decimalText(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const s = v.replace(/[\s ]/g, "");
  const comma = s.lastIndexOf(",");
  const dot = s.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) return comma > dot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  if (comma >= 0 && s.indexOf(",") === comma) return s.replace(",", ".");
  return s;
}

/** A number from a text input, with a decimal comma or point. */
export const decimal = <S extends z.ZodTypeAny>(schema: S) => z.preprocess(decimalText, schema);

/** Optional number from a text input ("12,5" or "12.5"). */
export const optionalNumber = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : decimalText(v)),
  z.coerce.number().finite().optional(),
);

/** Optional date (YYYY-MM-DD) from a date input. */
export const optionalDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
);

/** Optional id (empty select value = undefined). */
export const optionalId = z.preprocess((v) => (v === "" || v === "__none__" ? undefined : v), z.string().min(1).optional());

/** Checkbox: "on" / missing. */
export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/**
 * Turn a thrown domain error into a FormState. Domain errors carry an
 * optional `field`; anything else becomes a generic message (and is logged).
 */
export function errorState(err: unknown, values?: Record<string, string>): FormState {
  if (err && typeof err === "object" && "message" in err) {
    const e = err as { message: string; field?: string; name?: string };
    if (e.name === "ForbiddenError") return { ok: false, error: "You do not have permission to do that.", values };
    if (e.field) return { ok: false, fieldErrors: { [e.field]: e.message }, values };
    if (e.name && e.name.endsWith("Error") && e.name !== "Error" && e.name !== "PrismaClientKnownRequestError") {
      return { ok: false, error: e.message, values };
    }
  }
  console.error(err);
  return { ok: false, error: "Something went wrong. Try again.", values };
}
