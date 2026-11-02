import { z } from "zod";

/** One to-do line. */
export const todoText = z.string().trim().min(1, "Write something first.").max(500);
