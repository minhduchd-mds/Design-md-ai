/**
 * Tests for POST /api/agents/run — Agent Fleet v6 API endpoint.
 */

import { describe, it, expect } from "vitest";
import handler from "../agents/run";

// ── Helper: build a minimal Request for Edge runtime handler ────────

function buildRequest(body: unknown, method = "POST"): Request {
  return new Request("https://localhost/api/agents/run", {
    method,
    headers: { "Content-Type": "application/json", origin: "http://localhost:5173" },
    ...(method !== "OPTIONS" ? { body: JSON.stringify(body) } : {}),
  });
}

describe("POST /api/agents/run", () => {
  // ── Preflight ──────────────────────────────────────────────────

  it("returns 200 for OPTIONS preflight", async () => {
    const req = new Request("https://localhost/api/agents/run", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:5173" },
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
  });

  it("rejects GET requests", async () => {
    const req = new Request("https://localhost/api/agents/run", {
      method: "GET",
      headers: { origin: "http://localhost:5173" },
    });
    const res = await handler(req);
    expect(res.status).toBe(405);
  });

  // ── List agents ────────────────────────────────────────────────

  it("lists all 22 agents when listAgents=true", async () => {
    const res = await handler(buildRequest({ listAgents: true }));
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean; agents: unknown[]; fleets: string[] };
    expect(data.ok).toBe(true);
    expect(data.agents).toHaveLength(22);
    expect(data.fleets).toContain("audit");
    expect(data.fleets).toContain("safety");
    expect(data.fleets).toContain("verify");
  });

  // ── Validation ─────────────────────────────────────────────────

  it("rejects missing fleet and agentId", async () => {
    const res = await handler(buildRequest({ input: {} }));
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("Provide agentId or fleet");
  });

  it("rejects invalid fleet name", async () => {
    const res = await handler(buildRequest({ fleet: "nonexistent" }));
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("Invalid fleet");
  });

  it("rejects unknown agent ID", async () => {
    const res = await handler(buildRequest({ agentId: "fake.agent" }));
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("Unknown agent");
  });

  // ── Valid requests ─────────────────────────────────────────────

  it("queues a fleet run and returns 202", async () => {
    const res = await handler(buildRequest({ fleet: "audit" }));
    expect(res.status).toBe(202);
    const data = await res.json() as { ok: boolean; status: string; runId: string; fleet: string; agents: string[] };
    expect(data.ok).toBe(true);
    expect(data.status).toBe("queued");
    expect(data.fleet).toBe("audit");
    expect(data.agents).toContain("audit.architecture-drift");
    expect(data.runId).toBeTruthy();
  });

  it("queues a single agent run", async () => {
    const res = await handler(buildRequest({ agentId: "safety.safety-gate" }));
    expect(res.status).toBe(202);
    const data = await res.json() as { ok: boolean; agents: string[] };
    expect(data.ok).toBe(true);
    expect(data.agents).toEqual(["safety.safety-gate"]);
  });

  it("returns all agents for self-improve fleet", async () => {
    const res = await handler(buildRequest({ fleet: "self-improve" }));
    expect(res.status).toBe(202);
    const data = await res.json() as { agents: string[] };
    expect(data.agents).toHaveLength(6);
    expect(data.agents).toContain("self-improve.self-diagnostic");
    expect(data.agents).toContain("self-improve.benchmark");
  });

  it("passes budget through", async () => {
    const res = await handler(buildRequest({ fleet: "verify", budget: 0.5 }));
    const data = await res.json() as { budget: number };
    expect(data.budget).toBe(0.5);
  });

  it("defaults budget to 1.0", async () => {
    const res = await handler(buildRequest({ fleet: "verify" }));
    const data = await res.json() as { budget: number };
    expect(data.budget).toBe(1.0);
  });

  // ── Invalid JSON ───────────────────────────────────────────────

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("https://localhost/api/agents/run", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "http://localhost:5173" },
      body: "not-json{",
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });
});
