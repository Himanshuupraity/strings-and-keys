/**
 * Fixed-window-ish sliding log rate limiter, in memory. Fine for a single server instance;
 * on serverless/multi-instance hosting it limits per instance (documented in README).
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private limit: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  /** Records a hit and returns whether it is allowed, plus seconds until the next slot frees up. */
  check(key: string): { allowed: boolean; remaining: number; retryAfterSec: number } {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((h) => t - h < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      const retryAfterSec = Math.max(1, Math.ceil((recent[0] + this.windowMs - t) / 1000));
      return { allowed: false, remaining: 0, retryAfterSec };
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) this.prune(t);
    return { allowed: true, remaining: this.limit - recent.length, retryAfterSec: 0 };
  }

  private prune(t: number) {
    for (const [k, v] of this.hits) if (!v.some((h) => t - h < this.windowMs)) this.hits.delete(k);
  }
}
