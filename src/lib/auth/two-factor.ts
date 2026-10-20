import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Role } from "../../../config/app.config";

/**
 * Server-side 2FA helpers: who must use it, and how the TOTP secret is kept.
 *
 * The secret is stored encrypted (AES-256-GCM, key derived from
 * AUTH_SECRET, the user id as associated data), so a database dump or
 * backup alone cannot produce codes. Changing AUTH_SECRET therefore turns
 * every user's 2FA off in effect: they sign in with a recovery code or an
 * admin resets it (scripts/create-admin.mjs does too).
 */

function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return createHash("sha256").update(`vertigo-gear:totp:${secret}`).digest();
}

/** "v1.<iv>.<tag>.<ciphertext>", all base64url. */
export function sealSecret(secret: string, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(userId));
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** The secret, or null when the box was made for another user, tampered with or sealed under another AUTH_SECRET. */
export function openSecret(sealed: string, userId: string): string | null {
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(userId));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Roles that must use 2FA: TWO_FACTOR_REQUIRED_ROLES, comma-separated
 * ("admin", "admin,member"); "none" or empty turns the requirement off
 * (CI and the browser tests). Unset means admins.
 */
export function parseRequiredRoles(env: string | undefined): string[] {
  if (env === undefined) return ["admin"];
  return env
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r && r !== "none");
}

export function requiredRoles(): string[] {
  return parseRequiredRoles(process.env.TWO_FACTOR_REQUIRED_ROLES);
}

export function twoFactorRequired(role: Role, roles: string[] = requiredRoles()): boolean {
  return roles.includes(role);
}
