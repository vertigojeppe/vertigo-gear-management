import { z } from "zod";
import { decimal, optionalNumber, optionalText } from "@/lib/forms";
import { SETUP_PHASES, type SetupCondition } from "../../../config/app.config";

const optionalCount = optionalNumber.pipe(z.number().int("Whole numbers only.").min(1, "At least 1.").max(10000).optional());

/** An installation type and its rule of thumb. */
export const installationTypeInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  description: optionalText,
  baseHours: optionalNumber.pipe(z.number().min(0).max(1000).optional()),
  minutesPerUnit: optionalNumber.pipe(z.number().min(0).max(10000).optional()),
  unitName: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(60).optional()),
  ruleCrew: optionalCount,
  ruleNotes: optionalText,
});
export type InstallationTypeInput = z.infer<typeof installationTypeInput>;

/** One remembered (or, later, debriefed) build-up or pack-down. The action fills `conditions` from the checkboxes (`getAll`). */
export const setupRecordInput = z.object({
  typeId: z.string().min(1),
  phase: z.enum(SETUP_PHASES).default("build"),
  period: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(60).optional()),
  units: optionalCount,
  crew: optionalCount,
  hours: decimal(z.coerce.number({ message: "How many hours?" }).positive("How many hours?").max(1000)),
  lesson: optionalText,
});
export type SetupRecordInput = z.infer<typeof setupRecordInput> & { conditions: SetupCondition[] };
