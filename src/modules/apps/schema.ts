import { z } from "zod";
import { APP_KINDS } from "../../../config/app.config";
import { optionalText } from "@/lib/forms";

export const APP_KIND_KEYS = APP_KINDS.map((k) => k.key) as [string, ...string[]];

const optionalUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v),
  z
    .string()
    .max(2000)
    .refine((s) => /^https?:\/\//i.test(s), "Enter a full address starting with http:// or https://.")
    .optional(),
);

/** An entry in the apps list. The kind is chosen once; a link needs its address. */
export const appInput = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(120),
    kind: z.enum(APP_KIND_KEYS),
    category: optionalText,
    description: optionalText,
    url: optionalUrl,
  })
  .refine((v) => v.kind !== "link" || Boolean(v.url), { path: ["url"], message: "A link needs an address." });
export type AppInput = z.infer<typeof appInput>;

/** Label and notes for a new version; the file itself comes from the chunked upload. */
export const appVersionInput = z.object({
  appId: z.string().min(1),
  fileId: z.string().min(1),
  label: optionalText,
  notes: optionalText,
});
export type AppVersionInput = z.infer<typeof appVersionInput>;

export const appFilters = z.object({
  q: optionalText,
  kind: z.enum(APP_KIND_KEYS).optional().catch(undefined),
  archived: z.preprocess((v) => v === "1" || v === "true", z.boolean()).optional(),
});
export type AppFilters = z.infer<typeof appFilters>;
