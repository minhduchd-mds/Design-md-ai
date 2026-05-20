/**
 * quota — Tier-based quota enforcement for Desygn A11y.
 *
 * Audit quota is a monthly count (from usage_events). API quota is an
 * hourly sliding window (Upstash Redis). The tier→limit table and the
 * pure "is within quota" math are testable without a backend; the DB /
 * Redis reads degrade gracefully when unconfigured (allow, so local dev
 * and tests never hard-fail on missing env).
 */

import { Redis } from "@upstash/redis";
import { getSupabaseAdmin } from "./supabase-admin.js";
import type { Tier } from "./auth.js";

export type QuotaResource = "audit" | "api";

export interface TierQuota {
  /** Audits allowed per calendar month (Infinity = unlimited). */
  auditsPerMonth: number;
  /** API calls allowed per rolling hour (0 = no API access). */
  apiCallsPerHour: number;
}

export const TIER_QUOTAS: Record<Tier, TierQuota> = {
  free: { auditsPerMonth: 5, apiCallsPerHour: 0 },
  pro: { auditsPerMonth: 100, apiCallsPerHour: 100 },
  team: { auditsPerMonth: 1000, apiCallsPerHour: 1000 },
  enterprise: { auditsPerMonth: Infinity, apiCallsPerHour: Infinity },
};

export interface QuotaResult {
  allowed: boolean;
  /** Remaining units in the current window (Infinity for enterprise). */
  remaining: number;
  /** The limit for this tier+resource. */
  limit: number;
  /** When the window resets. */
  resetAt: Date;
}

// ─── Pure helpers (unit-tested) ──────────────────────────────────────

/** The numeric limit for a tier + resource. */
export function getQuotaForTier(tier: Tier, resource: QuotaResource): number {
  const q = TIER_QUOTAS[tier];
  return resource === "audit" ? q.auditsPerMonth : q.apiCallsPerHour;
}

/** Pure: given a usage count and a limit, compute the quota verdict. */
export function evaluateQuota(used: number, limit: number): { allowed: boolean; remaining: number } {
  if (limit === Infinity) return { allowed: true, remaining: Infinity };
  const remaining = Math.max(0, limit - used);
  return { allowed: used < limit, remaining };
}

/** First day of the current month at 00:00 (UTC). */
export function startOfMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** First day of next month (when the monthly audit quota resets). */
export function startOfNextMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** Top of the next hour (when the hourly API quota resets). */
export function startOfNextHour(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + 1);
  return d;
}

// ─── Redis (lazy) ────────────────────────────────────────────────────

let redis: Redis | null = null;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!redis) redis = new Redis({ url, token });
  return redis;
}

/** Test-only reset. */
export function __resetQuotaClientsForTests(): void {
  redis = null;
}

// ─── Main entry ──────────────────────────────────────────────────────

/**
 * Check whether `userId` (on `tier`) may consume one unit of `resource`.
 * Does NOT record usage — call recordUsage() after a successful action.
 *
 * Graceful degradation: if the backing store is unconfigured, returns
 * "allowed" with the tier limit so local/dev never hard-fails.
 */
export async function checkQuota(
  userId: string,
  tier: Tier,
  resource: QuotaResource,
): Promise<QuotaResult> {
  const limit = getQuotaForTier(tier, resource);

  // Free tier has zero API access — deny before any I/O.
  if (resource === "api" && limit === 0) {
    return { allowed: false, remaining: 0, limit, resetAt: startOfNextHour() };
  }

  if (resource === "audit") {
    const admin = getSupabaseAdmin();
    if (!admin) {
      const { allowed, remaining } = evaluateQuota(0, limit);
      return { allowed, remaining, limit, resetAt: startOfNextMonth() };
    }
    const { count } = await admin
      .from("usage_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_type", "audit")
      .gte("created_at", startOfMonth().toISOString());
    const { allowed, remaining } = evaluateQuota(count ?? 0, limit);
    return { allowed, remaining, limit, resetAt: startOfNextMonth() };
  }

  // resource === "api" — hourly sliding window via Redis
  const client = getRedis();
  if (!client) {
    const { allowed, remaining } = evaluateQuota(0, limit);
    return { allowed, remaining, limit, resetAt: startOfNextHour() };
  }
  const bucket = new Date().toISOString().slice(0, 13); // yyyy-mm-ddTHH
  const key = `quota:${userId}:api:${bucket}`;
  const used = await client.incr(key); // this call counts as one
  await client.expire(key, 3600);
  const remaining = Math.max(0, limit - used);
  return { allowed: used <= limit, remaining, limit, resetAt: startOfNextHour() };
}

/** Record one unit of usage (no-op when backend unconfigured). */
export async function recordUsage(
  userId: string,
  eventType: QuotaResource | "pdf_export",
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin.from("usage_events").insert({ user_id: userId, event_type: eventType, metadata });
}
