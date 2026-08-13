// Deliberately simple in-memory, fixed-window rate limiter — good enough to
// stop accidental hammering (e.g. a broken retry loop) or casual abuse of a
// demo deployment. It is NOT a production-grade distributed limiter: on
// Vercel's serverless functions each cold instance gets its own Map, so a
// determined caller spread across instances isn't actually bounded. A real
// production deployment would swap this for Upstash Redis / Vercel KV
// (@upstash/ratelimit is the standard choice) — same call signature, just a
// shared store instead of `hits`.

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= limit) {
    return { ok: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { ok: true };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
