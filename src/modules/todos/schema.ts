import { z } from "zod";

/** One to-do line. */
export const todoText = z.string().trim().min(1, "Write something first.").max(500);

/** A line and its optional category (empty = none). */
export const todoInput = z.object({
  text: todoText,
  category: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => v || null),
});
export type TodoInput = z.input<typeof todoInput>;
