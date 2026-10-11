import { z } from "zod";
import { ROLE_KEYS } from "../../../config/app.config";
import { checkbox, optionalText } from "@/lib/forms";

export const passwordSchema = z.string().min(8, "At least 8 characters.").max(200);

export const userInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  name: z.string().trim().min(1, "Name is required.").max(100),
  role: z.enum(ROLE_KEYS as [string, ...string[]]),
  phone: optionalText,
  googleEmail: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().toLowerCase().email().optional()),
  active: checkbox,
});
export type UserInput = z.infer<typeof userInput>;

export const createUserInput = userInput.extend({
  password: passwordSchema,
});

export const setPasswordInput = z.object({
  password: passwordSchema,
});

export const changeOwnPasswordInput = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." });

export const apiTokenInput = z.object({
  name: z.string().trim().min(1, "Give the token a name.").max(60),
});
