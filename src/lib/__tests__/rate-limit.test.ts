import { describe, expect, it } from "vitest";
import { clientAddress, createRateLimiter } from "../rate-limit";

describe("login rate limiter", () => {
  it("blocks after the maximum failures inside the window and frees the key when it passes", () => {
    const rl = createRateLimiter({ max: 3, windowMs: 1000 });
    const t = 10_000;
    expect(rl.allowed("a", t)).toBe(true);
    expect(rl.failed("a", t)).toBe(2);
    expect(rl.failed("a", t + 10)).toBe(1);
    expect(rl.failed("a", t + 20)).toBe(0);
    expect(rl.allowed("a", t + 30)).toBe(false);
    expect(rl.retryAfterMs("a", t + 30)).toBe(970);
    expect(rl.allowed("b", t + 30)).toBe(true); // other keys unaffected
    expect(rl.allowed("a", t + 1001)).toBe(true); // first failure fell out of the window
  });
  it("forgets a key on success", () => {
    const rl = createRateLimiter({ max: 2, windowMs: 1000 });
    rl.failed("a", 0);
    rl.failed("a", 1);
    expect(rl.allowed("a", 2)).toBe(false);
    rl.succeeded("a");
    expect(rl.allowed("a", 3)).toBe(true);
  });
  it("reads the client address from the proxy headers", () => {
    expect(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientAddress(new Headers({ "x-real-ip": "203.0.113.5" }))).toBe("203.0.113.5");
    expect(clientAddress(new Headers())).toBe("local");
    expect(clientAddress(undefined)).toBe("local");
  });
});
