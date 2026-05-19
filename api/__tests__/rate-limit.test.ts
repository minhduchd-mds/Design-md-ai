import { describe, it, expect, vi, beforeEach } from "vitest";
import { rateLimit, getClientIdentifier } from "../lib/rate-limit";

// No UPSTASH env vars → graceful degradation (allow all)
beforeEach(() => {
  vi.unstubAllEnvs();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("getClientIdentifier", () => {
  it("extracts first IP from x-forwarded-for string", () => {
    expect(getClientIdentifier({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })).toBe("1.2.3.4");
  });

  it("extracts first IP from x-forwarded-for array", () => {
    expect(getClientIdentifier({ "x-forwarded-for": ["10.0.0.1, 10.0.0.2"] })).toBe("10.0.0.1");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIdentifier({ "x-real-ip": "9.8.7.6" })).toBe("9.8.7.6");
  });

  it("returns 'anonymous' when no headers present", () => {
    expect(getClientIdentifier({})).toBe("anonymous");
  });
});

describe("rateLimit (graceful degradation)", () => {
  it("allows all requests when Upstash env vars are missing", async () => {
    const result = await rateLimit("test:127.0.0.1");
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(20);
    expect(result.limit).toBe(20);
    expect(result.reset).toBeGreaterThan(0);
  });

  it("respects custom maxRequests parameter", async () => {
    const result = await rateLimit("test:127.0.0.1", 10);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(10);
    expect(result.limit).toBe(10);
  });
});
