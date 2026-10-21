"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { clientAddress, loginLimiter } from "@/lib/rate-limit";
import { users } from "@/modules/users";

export type LoginState = { error?: "invalid" | "invalidCode" | "error" | "rateLimited"; retryMinutes?: number; needCode?: boolean };

function safeNext(next: FormDataEntryValue | null): string {
  // Only allow same-origin paths to avoid open redirects.
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

/**
 * Sign in, in two steps for users with two-factor sign-in: a right
 * password without a code answers `needCode` and the form asks for the
 * code from the app (or a recovery code), keeping email and password.
 * After ten wrong passwords or codes for the same email from the same
 * address the form refuses for fifteen minutes (src/lib/rate-limit.ts);
 * signing in clears the count.
 */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const key = `${clientAddress(await headers())}|${email}`;
  if (!loginLimiter.allowed(key)) return { error: "rateLimited", retryMinutes: Math.max(1, Math.ceil(loginLimiter.retryAfterMs(key) / 60_000)), needCode: Boolean(code) };
  if (!code) {
    // Only a right password reveals that the account wants a code.
    const user = email && password ? await users.verifyCredentials(email, password) : null;
    if (!user) {
      loginLimiter.failed(key);
      return { error: "invalid" };
    }
    if (user.twoFactor) return { needCode: true };
  }
  try {
    await signIn("credentials", {
      email,
      password,
      code: code || undefined,
      redirectTo: safeNext(formData.get("next")),
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") {
        loginLimiter.failed(key);
        return code ? { error: "invalidCode", needCode: true } : { error: "invalid" };
      }
      return { error: "error" };
    }
    // signIn redirects by throwing; a redirect means the password was right.
    loginLimiter.succeeded(key);
    throw err;
  }
}
