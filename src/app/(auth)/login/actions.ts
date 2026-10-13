"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { clientAddress, loginLimiter } from "@/lib/rate-limit";

export type LoginState = { error?: "invalid" | "error" | "rateLimited"; retryMinutes?: number };

function safeNext(next: FormDataEntryValue | null): string {
  // Only allow same-origin paths to avoid open redirects.
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

/**
 * Sign in. After ten wrong passwords for the same email from the same
 * address the form refuses for fifteen minutes (src/lib/rate-limit.ts);
 * a correct password clears the count.
 */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const key = `${clientAddress(await headers())}|${email}`;
  if (!loginLimiter.allowed(key)) return { error: "rateLimited", retryMinutes: Math.max(1, Math.ceil(loginLimiter.retryAfterMs(key) / 60_000)) };
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: safeNext(formData.get("next")),
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") {
        loginLimiter.failed(key);
        return { error: "invalid" };
      }
      return { error: "error" };
    }
    // signIn redirects by throwing; a redirect means the password was right.
    loginLimiter.succeeded(key);
    throw err;
  }
}
