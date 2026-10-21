import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hashRecoveryCode, isRecoveryCodeShape, newRecoveryCodes, newTotpSecret, otpauthUrl, totpCode, totpStep, verifyTotp } from "../totp";
import { openSecret, parseRequiredRoles, sealSecret, twoFactorRequired } from "../two-factor";

// RFC 6238 appendix B: SHA1 seed "12345678901234567890"; the RFC's codes are 8 digits, apps show the last 6.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP", () => {
  it("encodes base32 the way authenticator apps read it", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode("gezd gnbv-gy3t qojq gezd gnbv gy3t qojq").toString()).toBe("12345678901234567890");
    const s = newTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(s))).toBe(s);
  });

  it("matches the RFC 6238 test vectors", () => {
    expect(totpCode(RFC_SECRET, totpStep(new Date(59_000)), 8)).toBe("94287082");
    expect(totpCode(RFC_SECRET, totpStep(new Date(1_111_111_109_000)), 8)).toBe("07081804");
    expect(totpCode(RFC_SECRET, totpStep(new Date(1_234_567_890_000)))).toBe("005924");
    expect(totpCode(RFC_SECRET, totpStep(new Date(2_000_000_000_000)), 8)).toBe("69279037");
  });

  it("accepts the current code and one step either side, each step once", () => {
    const at = new Date(1_234_567_890_000);
    const step = totpStep(at);
    expect(verifyTotp(RFC_SECRET, "005924", at)).toBe(step);
    expect(verifyTotp(RFC_SECRET, "005 924", at)).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), at)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), at)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), at)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "005924", at, step)).toBeNull(); // already used
    expect(verifyTotp(RFC_SECRET, "12345", at)).toBeNull();
  });

  it("builds the otpauth address for the QR code", () => {
    expect(otpauthUrl("Vertigo Gear", "a@b.dk", "ABC")).toBe("otpauth://totp/Vertigo%20Gear:a%40b.dk?secret=ABC&issuer=Vertigo%20Gear&algorithm=SHA1&digits=6&period=30");
  });
});

describe("recovery codes", () => {
  it("are ten distinct readable codes, matched however they are typed", () => {
    const codes = newRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/);
    expect(hashRecoveryCode("ab3d-ef7h")).toBe(hashRecoveryCode(" AB3D EF7H "));
    expect(isRecoveryCodeShape("ab3d-ef7h")).toBe(true);
    expect(isRecoveryCodeShape("123456")).toBe(false);
    expect(isRecoveryCodeShape("1234-5678")).toBe(false);
  });
});

describe("2FA secret box and requirement", () => {
  it("opens only for the same user", () => {
    const sealed = sealSecret("SECRETSECRET", "user-a");
    expect(sealed).not.toContain("SECRETSECRET");
    expect(openSecret(sealed, "user-a")).toBe("SECRETSECRET");
    expect(openSecret(sealed, "user-b")).toBeNull();
    expect(openSecret(sealed.replace(/.$/, (c) => (c === "A" ? "B" : "A")), "user-a")).toBeNull();
    expect(openSecret("garbage", "user-a")).toBeNull();
  });

  it("requires admins unless configured otherwise", () => {
    expect(parseRequiredRoles(undefined)).toEqual(["admin"]);
    expect(parseRequiredRoles("none")).toEqual([]);
    expect(parseRequiredRoles("")).toEqual([]);
    expect(parseRequiredRoles("admin, member")).toEqual(["admin", "member"]);
    expect(twoFactorRequired("admin", ["admin"])).toBe(true);
    expect(twoFactorRequired("member", ["admin"])).toBe(false);
  });
});
