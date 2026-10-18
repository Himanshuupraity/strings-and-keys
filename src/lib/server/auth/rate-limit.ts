/**
 * Simple in-memory sliding-window rate limiter. Per server instance only — good enough to slow
 * down brute force on a single Node server; use a shared store (e.g. Redis) when scaling out.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private readonly limit: number, private readonly windowMs: number, private readonly now: () => number = Date.now) {}

  /** Records a hit. Returns whether it is allowed and, if not, how long to wait. */
  check(key: string): { ok: boolean; remaining: number; retryAfterSec: number } {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { ok: false, remaining: 0, retryAfterSec: Math.ceil((recent[0] + this.windowMs - t) / 1000) };
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(t);
    return { ok: true, remaining: this.limit - recent.length, retryAfterSec: 0 };
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private prune(t: number) {
    for (const [k, v] of this.hits) if (!v.some((x) => t - x < this.windowMs)) this.hits.delete(k);
  }
}

export const loginLimiter = new RateLimiter(10, 15 * 60 * 1000);
export const registerLimiter = new RateLimiter(5, 60 * 60 * 1000);
export const syncLimiter = new RateLimiter(30, 60 * 1000);

/** Best-effort client IP (first X-Forwarded-For hop when behind a proxy). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}
