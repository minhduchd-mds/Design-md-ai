import { describe, it, expect, vi } from "vitest";
import { SelfAuditAgent, type AgentRunRecord } from "../self-improve/SelfAuditAgent";
import type { AgentContextV6 } from "../BaseAgent";

function makeCtx(): AgentContextV6 {
  return {
    runId: "r1", projectId: "p1", costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

function makeRun(agentId: string, success: boolean, costUsd = 0.01, latencyMs = 100, ts = Date.now(), error?: string): AgentRunRecord {
  return { agentId, runId: `r-${ts}`, success, costUsd, latencyMs, timestamp: ts, error };
}

describe("SelfAuditAgent", () => {
  it("reports health for agents with enough runs", async () => {
    const agent = new SelfAuditAgent();
    const runs: AgentRunRecord[] = [
      makeRun("agent-a", true, 0.01, 100, 1),
      makeRun("agent-a", true, 0.02, 150, 2),
      makeRun("agent-a", false, 0.01, 200, 3, "timeout"),
      makeRun("agent-a", true, 0.01, 120, 4),
    ];
    const result = await agent.execute({ runs, minRuns: 3 }, makeCtx());
    expect(result.output!.reports).toHaveLength(1);
    expect(result.output!.reports[0].agentId).toBe("agent-a");
    expect(result.output!.reports[0].successRate).toBe(0.75);
    expect(result.output!.reports[0].grade).toBe("B");
  });

  it("skips agents with fewer runs than minRuns", async () => {
    const agent = new SelfAuditAgent();
    const runs: AgentRunRecord[] = [
      makeRun("agent-a", true, 0.01, 100, 1),
      makeRun("agent-a", true, 0.01, 100, 2),
    ];
    const result = await agent.execute({ runs, minRuns: 3 }, makeCtx());
    expect(result.output!.reports).toHaveLength(0);
  });

  it("grades correctly: A (>90%), C (50-75%), F (<25%)", async () => {
    const agent = new SelfAuditAgent();
    const runs: AgentRunRecord[] = [
      // Agent A: 100% success → grade A
      ...Array.from({ length: 5 }, (_, i) => makeRun("good", true, 0.01, 100, i)),
      // Agent B: 50% success → grade C
      ...Array.from({ length: 4 }, (_, i) => makeRun("ok", i < 2, 0.01, 100, i)),
      // Agent C: 0% success → grade F
      ...Array.from({ length: 4 }, (_, i) => makeRun("bad", false, 0.01, 100, i, "error")),
    ];
    const result = await agent.execute({ runs, minRuns: 3 }, makeCtx());
    const grades = Object.fromEntries(result.output!.reports.map((r) => [r.agentId, r.grade]));
    expect(grades["good"]).toBe("A");
    expect(grades["ok"]).toBe("C");
    expect(grades["bad"]).toBe("F");
  });

  it("identifies agents needing attention (grade C or worse)", async () => {
    const agent = new SelfAuditAgent();
    const runs: AgentRunRecord[] = [
      ...Array.from({ length: 5 }, (_, i) => makeRun("healthy", true, 0.01, 100, i)),
      ...Array.from({ length: 5 }, (_, i) => makeRun("sick", false, 0.01, 100, i, "err")),
    ];
    const result = await agent.execute({ runs, minRuns: 3 }, makeCtx());
    expect(result.output!.needsAttention).toContain("sick");
    expect(result.output!.needsAttention).not.toContain("healthy");
  });

  it("detects recurring failures (3+ consecutive)", async () => {
    const agent = new SelfAuditAgent();
    const runs: AgentRunRecord[] = [
      makeRun("flaky", true, 0.01, 100, 1),
      makeRun("flaky", false, 0.01, 100, 2, "err"),
      makeRun("flaky", false, 0.01, 100, 3, "err"),
      makeRun("flaky", false, 0.01, 100, 4, "err"),
      makeRun("flaky", true, 0.01, 100, 5),
    ];
    const result = await agent.execute({ runs, minRuns: 3 }, makeCtx());
    expect(result.output!.recurringFailures).toContain("flaky");
  });

  it("computes fleet health score", async () => {
    const agent = new SelfAuditAgent();
    const runs: AgentRunRecord[] = [
      ...Array.from({ length: 4 }, (_, i) => makeRun("a", true, 0.01, 100, i)),
      ...Array.from({ length: 4 }, (_, i) => makeRun("b", i < 2, 0.01, 100, i)),
    ];
    const result = await agent.execute({ runs, minRuns: 3 }, makeCtx());
    expect(result.output!.fleetHealthScore).toBeGreaterThan(0);
    expect(result.output!.fleetHealthScore).toBeLessThanOrEqual(100);
  });

  it("generates recommendations for failing agents", async () => {
    const agent = new SelfAuditAgent();
    const runs: AgentRunRecord[] = [
      ...Array.from({ length: 5 }, (_, i) => makeRun("broken", false, 0.5, 50000, i, "timeout")),
    ];
    const result = await agent.execute({ runs, minRuns: 3 }, makeCtx());
    expect(result.output!.recommendations.length).toBeGreaterThan(0);
    expect(result.output!.recommendations.some((r) => r.includes("broken"))).toBe(true);
  });

  it("reports overall stats", async () => {
    const agent = new SelfAuditAgent();
    const runs: AgentRunRecord[] = [
      makeRun("a", true, 0.1, 200, 1),
      makeRun("a", true, 0.2, 300, 2),
      makeRun("a", false, 0.05, 100, 3),
    ];
    const result = await agent.execute({ runs, minRuns: 3 }, makeCtx());
    expect(result.output!.stats.totalRuns).toBe(3);
    expect(result.output!.stats.totalCostUsd).toBeCloseTo(0.35, 2);
    expect(result.output!.stats.avgLatencyMs).toBe(200);
  });
});
