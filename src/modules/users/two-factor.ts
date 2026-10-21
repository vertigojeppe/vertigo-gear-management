import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { hashRecoveryCode, isRecoveryCodeShape, newRecoveryCodes, newTotpSecret, otpauthUrl, verifyTotp } from "@/lib/auth/totp";
import { openSecret, sealSecret, twoFactorRequired } from "@/lib/auth/two-factor";
import { appConfig, isRole } from "../../../config/app.config";
import { UserError } from "./service";

/**
 * Two-factor sign-in with an authenticator app (TOTP) plus one-time
 * recovery codes. Setup is stateless until confirmed: the new secret
 * travels sealed in the setup form and is only stored once a code from the
 * app matches it. Every app code works once (`totpLastStep`), every
 * recovery code once (its hash leaves the list).
 */

const CLEARED = { totpSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: [] };

export type TwoFactorStatus = { enabled: boolean; enabledAt: Date | null; recoveryLeft: number; required: boolean };

const codeList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export const twoFactor = {
  async status(userId: string): Promise<TwoFactorStatus> {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, totpEnabledAt: true, recoveryCodes: true } });
    return { enabled: Boolean(u.totpEnabledAt), enabledAt: u.totpEnabledAt, recoveryLeft: codeList(u.recoveryCodes).length, required: twoFactorRequired(isRole(u.role) ? u.role : "viewer") };
  },

  /** A fresh secret for the setup page: shown as a QR code and as text, sealed for the form. Nothing is stored yet. */
  begin(actor: Actor): { sealed: string; secret: string; url: string } {
    const secret = newTotpSecret();
    return { sealed: sealSecret(secret, actor.id), secret, url: otpauthUrl(appConfig.name, actor.email, secret) };
  },

  /** Turns 2FA on once a code from the app matches the new secret; returns the recovery codes (shown once). */
  async confirm(actor: Actor, sealed: string, code: string): Promise<string[]> {
    const secret = openSecret(sealed, actor.id);
    if (!secret) throw new UserError("This setup has expired. Reload the page and scan the new QR code.", "code");
    const step = verifyTotp(secret, code);
    if (step === null) throw new UserError("That code does not match. Check that the phone's clock is right and type the newest code.", "code");
    const codes = newRecoveryCodes();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: actor.id }, data: { totpSecret: sealed, totpEnabledAt: new Date(), totpLastStep: step, recoveryCodes: codes.map(hashRecoveryCode) } });
      await logActivity(actor, { entityType: "user", entityId: actor.id, action: "two_factor_enabled", summary: `${actor.name} turned on two-factor sign-in` }, tx);
    });
    return codes;
  },

  /**
   * Checks a second-factor code at sign-in (or before a change): a code
   * from the app, each 30-second step at most once, or an unused recovery
   * code, which is used up.
   */
  async verify(userId: string, code: string): Promise<boolean> {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, totpSecret: true, totpEnabledAt: true, totpLastStep: true, recoveryCodes: true } });
    if (!u?.totpSecret || !u.totpEnabledAt) return false;
    const typed = code.trim();
    if (isRecoveryCodeShape(typed)) {
      const list = codeList(u.recoveryCodes);
      const hash = hashRecoveryCode(typed);
      if (!list.includes(hash)) return false;
      const left = list.filter((h) => h !== hash);
      // Only the request that still sees the code in the list may use it.
      const used = await prisma.user.updateMany({ where: { id: u.id, recoveryCodes: { equals: list } }, data: { recoveryCodes: left } });
      if (used.count !== 1) return false;
      const who: Actor = { id: u.id, name: u.name, email: u.email, role: isRole(u.role) ? u.role : "viewer" };
      await logActivity(who, { entityType: "user", entityId: u.id, action: "recovery_code_used", summary: `${u.name} signed in with a recovery code (${left.length} left)` });
      return true;
    }
    const secret = openSecret(u.totpSecret, u.id);
    if (!secret) return false;
    const step = verifyTotp(secret, typed, new Date(), u.totpLastStep);
    if (step === null) return false;
    const r = await prisma.user.updateMany({ where: { id: u.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] }, data: { totpLastStep: step } });
    return r.count === 1;
  },

  /** New recovery codes (the old ones stop working), after a current code. */
  async regenerateRecoveryCodes(actor: Actor, code: string): Promise<string[]> {
    if (!(await twoFactor.verify(actor.id, code))) throw new UserError("That code does not match.", "code");
    const codes = newRecoveryCodes();
    await prisma.user.update({ where: { id: actor.id }, data: { recoveryCodes: codes.map(hashRecoveryCode) } });
    await logActivity(actor, { entityType: "user", entityId: actor.id, action: "recovery_codes_renewed", summary: `${actor.name} made new recovery codes` });
    return codes;
  },

  /** Turn your own 2FA off (not allowed for roles that require it), after a current code. */
  async disable(actor: Actor, code: string): Promise<void> {
    if (twoFactorRequired(actor.role)) throw new UserError("Two-factor sign-in is required for your role and cannot be turned off.", "code");
    if (!(await twoFactor.verify(actor.id, code))) throw new UserError("That code does not match.", "code");
    await prisma.user.update({ where: { id: actor.id }, data: CLEARED });
    await logActivity(actor, { entityType: "user", entityId: actor.id, action: "two_factor_disabled", summary: `${actor.name} turned off two-factor sign-in` });
  },

  /** Admin: clear someone's 2FA (lost phone). They sign in with the password alone and, where required, set it up again. */
  async reset(actor: Actor, userId: string): Promise<void> {
    assertCan(actor, "users.manage");
    const u = await prisma.user.update({ where: { id: userId }, data: CLEARED });
    await logActivity(actor, { entityType: "user", entityId: userId, action: "two_factor_reset", summary: `Reset two-factor sign-in for ${u.name}` });
  },
};
