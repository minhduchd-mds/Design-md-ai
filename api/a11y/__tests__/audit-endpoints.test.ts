/**
 * audit-endpoints — unit tests for the Desygn A11y audit API.
 *
 * Deterministic + offline: we never hit the Figma REST API, Supabase, or
 * Redis. The 401 path short-circuits inside parseAuthHeader (no network),
 * and every other assertion exercises the pure helpers in _shared.ts.
 */

import { describe, it, expect } from "vitest";
import auditStartHandler from "../audit-start.js";
import {
  auditStartSchema,
  auditResultQuerySchema,
  jsonResponse,
  errorResponse,
  resolveAuditOptions,
  formatZodError,
  DEFAULT_WCAG_VERSION,
  DEFAULT_WCAG_LEVEL,
} from "../_shared.js";

// ─── Handler: auth gate ──────────────────────────────────────────────

describe("audit-start handler", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const req = new Request("http://x/api/a11y/audit-start", { method: "POST" });
    const res = await auditStartHandler(req);

    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("returns 405 for non-POST methods (before touching auth/network)", async () => {
    const req = new Request("http://x/api/a11y/audit-start", { method: "GET" });
    const res = await auditStartHandler(req);
    expect(res.status).toBe(405);
  });
});

// ─── Schema: auditStartSchema ────────────────────────────────────────

describe("auditStartSchema", () => {
  it("accepts a valid figma body", () => {
    const result = auditStartSchema.safeParse({
      source: "figma",
      figma: { fileKey: "abc123", accessToken: "figd_token" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid figma body with an optional nodeId + options", () => {
    const result = auditStartSchema.safeParse({
      source: "figma",
      figma: { fileKey: "abc123", nodeId: "1:23", accessToken: "figd_token" },
      options: { wcagVersion: "2.1", wcagLevel: "AAA", rules: ["contrast"] },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid uploaded-json body", () => {
    const result = auditStartSchema.safeParse({
      source: "uploaded-json",
      nodes: [{ id: "1", name: "Button", type: "INSTANCE" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts uploaded-json with nested children nodes", () => {
    const result = auditStartSchema.safeParse({
      source: "uploaded-json",
      nodes: [
        {
          id: "1",
          name: "Frame",
          type: "FRAME",
          children: [{ id: "2", name: "Label", type: "TEXT", contrastRatio: 4.5 }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a body missing the required source field", () => {
    const result = auditStartSchema.safeParse({
      figma: { fileKey: "abc", accessToken: "t" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid source value", () => {
    const result = auditStartSchema.safeParse({ source: "html" });
    expect(result.success).toBe(false);
  });

  it("rejects a figma source without figma credentials", () => {
    const result = auditStartSchema.safeParse({ source: "figma" });
    expect(result.success).toBe(false);
  });

  it("rejects figma credentials missing the access token", () => {
    const result = auditStartSchema.safeParse({
      source: "figma",
      figma: { fileKey: "abc" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an uploaded-json source with no nodes", () => {
    const result = auditStartSchema.safeParse({ source: "uploaded-json" });
    expect(result.success).toBe(false);
  });

  it("rejects an uploaded-json source with an empty nodes array", () => {
    const result = auditStartSchema.safeParse({ source: "uploaded-json", nodes: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a node missing required fields", () => {
    const result = auditStartSchema.safeParse({
      source: "uploaded-json",
      nodes: [{ id: "1", name: "no-type" }],
    });
    expect(result.success).toBe(false);
  });
});

// ─── Schema: auditResultQuerySchema ──────────────────────────────────

describe("auditResultQuerySchema", () => {
  it("accepts a non-empty id", () => {
    expect(auditResultQuerySchema.safeParse({ id: "run-1" }).success).toBe(true);
  });

  it("rejects a missing id", () => {
    expect(auditResultQuerySchema.safeParse({ id: null }).success).toBe(false);
  });

  it("rejects an empty id", () => {
    expect(auditResultQuerySchema.safeParse({ id: "" }).success).toBe(false);
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────

describe("jsonResponse", () => {
  it("sets the status and JSON content-type", async () => {
    const res = jsonResponse(200, { ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("merges extra headers", () => {
    const res = jsonResponse(200, {}, { "Cache-Control": "private, max-age=3600" });
    expect(res.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});

describe("errorResponse", () => {
  it("builds an { error } JSON body with the given status", async () => {
    const res = errorResponse(402, "quota exceeded", { remaining: 0 });
    expect(res.status).toBe(402);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: "quota exceeded", remaining: 0 });
  });
});

describe("resolveAuditOptions", () => {
  it("defaults to WCAG 2.2 AA when no options are given", () => {
    expect(resolveAuditOptions()).toEqual({
      wcagVersion: DEFAULT_WCAG_VERSION,
      wcagLevel: DEFAULT_WCAG_LEVEL,
    });
    expect(DEFAULT_WCAG_VERSION).toBe("2.2");
    expect(DEFAULT_WCAG_LEVEL).toBe("AA");
  });

  it("honors client-supplied version, level, and rules", () => {
    expect(
      resolveAuditOptions({ wcagVersion: "2.0", wcagLevel: "A", rules: ["contrast"] }),
    ).toEqual({ wcagVersion: "2.0", wcagLevel: "A", rules: ["contrast"] });
  });
});

describe("formatZodError", () => {
  it("flattens issues into path: message strings", () => {
    const result = auditStartSchema.safeParse({ source: "figma" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = formatZodError(result.error);
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some((m) => m.includes("figma"))).toBe(true);
    }
  });
});
