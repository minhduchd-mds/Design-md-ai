/**
 * auth — unit tests for the pure helpers + graceful-degrade paths.
 *
 * JWKS verification and DB lookups are NOT exercised here (they need a
 * live backend); we cover the token routing, hashing, header parsing, and
 * the "backend not configured" branches.
 */

import { describe, it, expect } from "vitest";
import {
  parseAuthHeader,
  classifyToken,
  normalizeTier,
  hashApiKey,
  AuthError,
  getUserTier,
} from "../auth.js";

describe("parseAuthHeader", () => {
  it("parses a valid Bearer header", () => {
    expect(parseAuthHeader("Bearer abc123")).toEqual({ scheme: "Bearer", token: "abc123" });
  });

  it("is case-insensitive on the scheme", () => {
    expect(parseAuthHeader("bearer xyz").token).toBe("xyz");
  });

  it("throws on missing header", () => {
    expect(() => parseAuthHeader(null)).toThrow(AuthError);
    expect(() => parseAuthHeader(undefined)).toThrow(/Missing/);
  });

  it("throws on malformed header", () => {
    expect(() => parseAuthHeader("Bearer")).toThrow(/Malformed/);
    expect(() => parseAuthHeader("Basic a b")).toThrow(/Malformed/);
  });

  it("throws on a non-Bearer scheme", () => {
    expect(() => parseAuthHeader("Basic abc")).toThrow(/scheme/);
  });
});

describe("classifyToken", () => {
  it("recognizes live + test API keys", () => {
    expect(classifyToken("dak_live_abc")).toBe("api-key");
    expect(classifyToken("dak_test_abc")).toBe("api-key");
  });

  it("recognizes a Supabase JWT shape", () => {
    expect(classifyToken("eyJhbGc.eyJzdWIi.sig")).toBe("supabase-jwt");
  });

  it("returns unknown for other strings", () => {
    expect(classifyToken("random")).toBe("unknown");
    expect(classifyToken("eyJonly-one-segment")).toBe("unknown");
  });
});

describe("normalizeTier", () => {
  it("passes through known tiers", () => {
    expect(normalizeTier("pro")).toBe("pro");
    expect(normalizeTier("team")).toBe("team");
    expect(normalizeTier("enterprise")).toBe("enterprise");
  });

  it("defaults unknown/empty to free", () => {
    expect(normalizeTier(undefined)).toBe("free");
    expect(normalizeTier("platinum")).toBe("free");
    expect(normalizeTier(null)).toBe("free");
  });
});

describe("hashApiKey", () => {
  it("produces a 64-char hex SHA-256 digest", async () => {
    const hash = await hashApiKey("dak_live_secret");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic and input-sensitive", async () => {
    const a = await hashApiKey("dak_live_one");
    const b = await hashApiKey("dak_live_one");
    const c = await hashApiKey("dak_live_two");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("matches a known SHA-256 vector", async () => {
    // SHA-256("abc")
    expect(await hashApiKey("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("getUserTier (graceful degrade)", () => {
  it("returns free when no Supabase backend is configured", async () => {
    const prevUrl = process.env.SUPABASE_URL;
    const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      expect(await getUserTier("user-1")).toBe("free");
    } finally {
      if (prevUrl) process.env.SUPABASE_URL = prevUrl;
      if (prevKey) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
    }
  });
});
