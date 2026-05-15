/**
 * In-memory sliding-window rate limiter for Vercel serverless functions.
 * Sprint 3 — Performance: prevents API abuse without requiring external Redis.
 *
 * Limits: 20 requests per 60-second window per IP.
 * Note: In-memory state resets on cold starts. For persistent rate limiting,
 * upgrade to @upstash/ratelimit + Redis when ready.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const CLEANUP_INTERVAL = 120_000;

// Periodic cleanup of stale entries
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - WINDOW_MS;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export function checkRateLimit(identifier: string): RateLimitResult {
  cleanup();
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  let entry = store.get(identifier);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(identifier, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);

  if (entry.timestamps.length >= MAX_REQUESTS) {
    const oldestInWindow = entry.timestamps[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldestInWindow + WINDOW_MS - now,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: MAX_REQUESTS - entry.timestamps.length,
    resetMs: WINDOW_MS,
  };
}

/**
 * Extract client IP from Vercel request headers.
 * Falls back to "unknown" if no forwarding header is present.
 */
export function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() ?? "unknown";
  if (Array.isArray(forwarded)) return forwarded[0]?.split(",")[0]?.trim() ?? "unknown";
  return (headers["x-real-ip"] as string) ?? "unknown";
}
