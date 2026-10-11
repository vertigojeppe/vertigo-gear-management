"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export type LoginState = { error?: "invalid" | "error" };

function safeNext(next: FormDataEntryValue | null): string {
  // Only allow same-origin paths to avoid open redirects.
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: safeNext(formData.get("next")),
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: err.type === "CredentialsSignin" ? "invalid" : "error" };
    }
    // signIn redirects by throwing; let Next handle that.
    throw err;
  }
}
