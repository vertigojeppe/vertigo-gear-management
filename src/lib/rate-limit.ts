/**
 * Small in-memory rate limiter for the login form: after `max` failed
 * attempts for a key (email + address) within `windowMs`, further attempts
 * are refused until the window has passed. One process, no store: fine for
 * a single app container, and the attacker it stops is the one guessing
 * passwords from one address. A success clears the key.
 */
export type RateLimiter = {
  /** True when the key may try now. */
  allowed(key: string, now?: number): boolean;
  /** Record a failed attempt; returns how many remain before the block. */
  failed(key: string, now?: number): number;
  succeeded(key: string): void;
  /** Milliseconds until the key may try again (0 when allowed). */
  retryAfterMs(key: string, now?: number): number;
};

export function createRateLimiter({ max = 10, windowMs = 15 * 60_000 }: { max?: number; windowMs?: number } = {}): RateLimiter {
  const hits = new Map<string, number[]>();
  const prune = (key: string, now: number) => {
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  };
  return {
    allowed(key, now = Date.now()) {
      return prune(key, now).length < max;
    },
    failed(key, now = Date.now()) {
      const list = prune(key, now);
      list.push(now);
      hits.set(key, list);
      return Math.max(0, max - list.length);
    },
    succeeded(key) {
      hits.delete(key);
    },
    retryAfterMs(key, now = Date.now()) {
      const list = prune(key, now);
      if (list.length < max) return 0;
      return Math.max(0, list[0] + windowMs - now);
    },
  };
}

/** The login limiter: 10 failed attempts per email + address, then 15 minutes off. */
export const loginLimiter: RateLimiter = (globalThis as { __loginLimiter?: RateLimiter }).__loginLimiter ?? createRateLimiter();
(globalThis as { __loginLimiter?: RateLimiter }).__loginLimiter = loginLimiter;

/** Client address behind a reverse proxy (Caddy sets X-Forwarded-For), else "local". */
export function clientAddress(headers: Headers | undefined): string {
  const fwd = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || headers?.get("x-real-ip") || "local";
}
