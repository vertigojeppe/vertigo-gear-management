import { z } from "zod";
import { LOGISTICS_KINDS, PLAN_ENTRY_KINDS, PLAN_PHASES } from "../../../config/app.config";
import { optionalDate, optionalId, optionalNumber, optionalText } from "@/lib/forms";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");
const timeString = z.string().regex(/^\d{2}:\d{2}$/, "Choose a time.");
const optionalTime = z.preprocess((v) => (v === "" ? undefined : v), timeString.optional());
const optionalMinutes = optionalNumber.transform((v) => (v === undefined ? undefined : Math.max(0, Math.round(v))));
/** datetime-local: "YYYY-MM-DDTHH:mm" or empty. */
const optionalDateTime = z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Choose a date and time.").optional());

export const planInput = z.object({
  notes: optionalText,
});
export type PlanInput = z.infer<typeof planInput>;

/** Create a plan; optionally from a template anchored on a day. */
export const createPlanInput = z.object({
  templateId: optionalId,
  anchorDate: optionalDate,
});

export const applyTemplateInput = z.object({
  templateId: z.string().min(1, "Choose a template."),
  anchorDate: dateString,
});

export const scheduleEntryInput = z.object({
  date: dateString,
  time: timeString,
  durationMin: optionalMinutes,
  title: z.string().trim().min(1, "What happens?").max(200),
  location: optionalText,
  responsibleId: optionalId,
  notes: optionalText,
});
export type ScheduleEntryInput = z.infer<typeof scheduleEntryInput>;

export const taskInput = z.object({
  phase: z.enum(PLAN_PHASES).default("pre_production"),
  title: z.string().trim().min(1, "What needs doing?").max(200),
  assigneeId: optionalId,
  dueDate: optionalDate,
  notes: optionalText,
});
export type TaskInput = z.infer<typeof taskInput>;

export const logisticsInput = z.object({
  kind: z.enum(LOGISTICS_KINDS).default("other"),
  title: z.string().trim().min(1, "Title is required.").max(200),
  details: optionalText,
  at: optionalDateTime,
});
export type LogisticsInput = z.infer<typeof logisticsInput>;

export const planTemplateInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  description: optionalText,
});
export type PlanTemplateInput = z.infer<typeof planTemplateInput>;

export const templateEntryInput = z.object({
  kind: z.enum(PLAN_ENTRY_KINDS),
  dayOffset: optionalNumber.transform((v) => Math.round(v ?? 0)),
  time: optionalTime,
  durationMin: optionalMinutes,
  title: z.string().trim().min(1, "Title is required.").max(200),
  location: optionalText,
  phase: z.preprocess((v) => (v === "" ? undefined : v), z.enum(PLAN_PHASES).optional()),
  logisticsKind: z.preprocess((v) => (v === "" ? undefined : v), z.enum(LOGISTICS_KINDS).optional()),
  notes: optionalText,
});
export type TemplateEntryInput = z.infer<typeof templateEntryInput>;

export const saveAsTemplateInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  anchorDate: dateString,
});
