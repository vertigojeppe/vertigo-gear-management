import { z } from "zod";
import { checkbox, optionalDate, optionalId, optionalText } from "@/lib/forms";
import { ENTRY_KINDS } from "../../../config/app.config";

const KINDS = ENTRY_KINDS.map((k) => k.key) as ["meeting", "time_off", "assignment"];
const optionalTime = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM.").optional());

/**
 * A calendar entry from the form. The people come separately (checkboxes,
 * `formData.getAll("people")`). Time off is always whole days; the others
 * are whole days when `allDay` is ticked, otherwise one day from–to.
 */
export const entryInput = z.object({
  kind: z.enum(KINDS),
  title: optionalText,
  projectId: optionalId,
  allDay: checkbox,
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  toDate: optionalDate,
  startTime: optionalTime,
  endTime: optionalTime,
  location: optionalText,
  notes: optionalText,
  /** Email addresses of people outside the app, one per line or separated by commas. */
  guestsText: optionalText,
});
export type EntryInput = z.infer<typeof entryInput>;
