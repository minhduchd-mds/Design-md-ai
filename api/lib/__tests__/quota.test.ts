/**
 * quota — unit tests for tier limits + pure math + graceful-degrade.
 */

import { describe, it, expect } from "vitest";
import {
  TIER_QUOTAS,
  getQuotaForTier,
  evaluateQuota,
  startOfMonth,
  startOfNextMonth,
  startOfNextHour,
  checkQuota,
} from "../quota.js";

describe("TIER_QUOTAS", () => {
  it("matches the published pricing", () => {
    expect(TIER_QUOTAS.free.auditsPerMonth).toBe(5);
    expect(TIER_QUOTAS.pro.auditsPerMonth).toBe(100);
    expect(TIER_QUOTAS.team.auditsPerMonth).toBe(1000);
    expect(TIER_QUOTAS.enterprise.auditsPerMonth).toBe(Infinity);
  });

  it("free tier has no API access", () => {
    expect(TIER_QUOTAS.free.apiCallsPerHour).toBe(0);
  });
});

describe("getQuotaForTier", () => {
  it("returns audit vs api limit", () => {
    expect(getQuotaForTier("pro", "audit")).toBe(100);
    expect(getQuotaForTier("pro", "api")).toBe(100);
    expect(getQuotaForTier("team", "api")).toBe(1000);
  });
});

describe("evaluateQuota", () => {
  it("allows while under the limit", () => {
    expect(evaluateQuota(4, 5)).toEqual({ allowed: true, remaining: 1 });
  });

  it("denies at the limit", () => {
    expect(evaluateQuota(5, 5)).toEqual({ allowed: false, remaining: 0 });
  });

  it("never reports negative remaining", () => {
    expect(evaluateQuota(8, 5)).toEqual({ allowed: false, remaining: 0 });
  });

  it("treats Infinity as always-allowed", () => {
    expect(evaluateQuota(9999, Infinity)).toEqual({ allowed: true, remaining: Infinity });
  });
});

describe("reset boundaries", () => {
  it("startOfMonth is the 1st at 00:00 UTC", () => {
    const d = startOfMonth(new Date("2026-05-20T13:45:00Z"));
    expect(d.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  it("startOfNextMonth rolls over the year in December", () => {
    const d = startOfNextMonth(new Date("2026-12-15T00:00:00Z"));
    expect(d.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("startOfNextHour advances and zeroes minutes", () => {
    const d = startOfNextHour(new Date("2026-05-20T13:45:30Z"));
    expect(d.toISOString()).toBe("2026-05-20T14:00:00.000Z");
  });
});

describe("checkQuota (graceful degrade + free API)", () => {
  it("denies API for free tier without any I/O", async () => {
    const r = await checkQuota("user-1", "free", "api");
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.limit).toBe(0);
  });

  it("allows audit when no Supabase backend (degrades open)", async () => {
    const prevUrl = process.env.SUPABASE_URL;
    const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const r = await checkQuota("user-1", "free", "audit");
      expect(r.allowed).toBe(true);
      expect(r.limit).toBe(5);
      expect(r.remaining).toBe(5);
    } finally {
      if (prevUrl) process.env.SUPABASE_URL = prevUrl;
      if (prevKey) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
    }
  });
});
