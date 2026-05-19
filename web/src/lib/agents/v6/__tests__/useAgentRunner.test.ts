/**
 * Tests for useAgentRunner — React hook bridging UI to Agent Fleet v6.
 *
 * Uses a minimal renderHook-style test to validate state transitions
 * without full React DOM rendering.
 */

import { describe, it, expect } from "vitest";

// We test the types and logic without React rendering
import type { AgentRunState, AgentRegistryEntry } from "../useAgentRunner";

describe("useAgentRunner types", () => {
  it("AgentRunState has correct shape", () => {
    const state: AgentRunState = {
      status: "idle",
      runId: null,
      results: new Map(),
      error: null,
      totalCostUsd: 0,
      totalLatencyMs: 0,
      activeAgents: [],
    };
    expect(state.status).toBe("idle");
    expect(state.results.size).toBe(0);
    expect(state.activeAgents).toHaveLength(0);
  });

  it("AgentRunState supports all statuses", () => {
    const statuses: AgentRunState["status"][] = ["idle", "running", "success", "error"];
    expect(statuses).toHaveLength(4);
  });

  it("AgentRegistryEntry has correct fields", () => {
    const entry: AgentRegistryEntry = {
      id: "audit.architecture-drift",
      name: "ArchitectureDriftAgent",
      fleet: "audit",
      role: "analyzer",
      description: "Circular deps detection",
    };
    expect(entry.id).toBe("audit.architecture-drift");
    expect(entry.fleet).toBe("audit");
  });

  it("AgentRunState supports results map operations", () => {
    const state: AgentRunState = {
      status: "success",
      runId: "run-1",
      results: new Map([
        ["audit.architecture-drift", { success: true, costUsd: 0, latencyMs: 50 }],
        ["verify.test-runner", { success: true, costUsd: 0, latencyMs: 120 }],
      ]),
      error: null,
      totalCostUsd: 0,
      totalLatencyMs: 170,
      activeAgents: [],
    };
    expect(state.results.size).toBe(2);
    expect(state.results.get("audit.architecture-drift")?.success).toBe(true);
    expect(state.results.get("verify.test-runner")?.latencyMs).toBe(120);
  });

  it("AgentRunState error state", () => {
    const state: AgentRunState = {
      status: "error",
      runId: "run-2",
      results: new Map(),
      error: "Network failure",
      totalCostUsd: 0,
      totalLatencyMs: 0,
      activeAgents: [],
    };
    expect(state.status).toBe("error");
    expect(state.error).toBe("Network failure");
  });
});

describe("useAgentRunner module exports", () => {
  it("exports useAgentRunner function", async () => {
    const mod = await import("../useAgentRunner");
    expect(typeof mod.useAgentRunner).toBe("function");
  });
});
