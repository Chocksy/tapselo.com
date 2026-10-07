const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 20);

/** @type {Map<string, { count: number; resetAt: number }>} */
const rateBuckets = new Map();

export function evictExpiredRateBuckets(now = Date.now()) {
  for (const [ip, b] of rateBuckets) {
    if (now >= b.resetAt) rateBuckets.delete(ip);
  }
}

export function checkRate(ip, now = Date.now()) {
  evictExpiredRateBuckets(now);
  let b = rateBuckets.get(ip);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(ip, b);
  }
  b.count += 1;
  return b.count <= RATE_LIMIT_MAX;
}

export function resetRateLimitForTests() {
  rateBuckets.clear();
}

export function rateLimitConfig() {
  return { windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX };
}
