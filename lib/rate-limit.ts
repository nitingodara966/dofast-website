type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Prevent unbounded growth; pruning kicks in well before this matters at MVP traffic.
const MAX_BUCKETS = 10_000;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Fixed-window in-memory rate limiter. State is per server instance, so on
 * serverless hosting the effective limit is per-instance — acceptable
 * abuse protection for the MVP waitlist, not a security boundary.
 */
export function checkRateLimit(
  key: string,
  { limit = 5, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): RateLimitResult {
  const now = Date.now();

  if (buckets.size >= MAX_BUCKETS) {
    for (const [k, bucket] of buckets) {
      if (now >= bucket.resetAt) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true };
}

export function resetRateLimiter() {
  buckets.clear();
}
