import { describe, it, expect, vi } from "vitest";
import { BenchmarkAgent, type MetricSnapshot } from "../self-improve/BenchmarkAgent";
import type { AgentContextV6 } from "../BaseAgent";

function makeCtx(): AgentContextV6 {
  return {
    runId: "r1", projectId: "p1", costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

function makeSnap(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    label: "baseline",
    timestamp: Date.now(),
    totalRuns: 100,
    successfulRuns: 80,
    patchesProposed: 50,
    patchesApproved: 40,
    patchesRejected: 10,
    regressionsIntroduced: 2,
    issuesFixed: 20,
    totalLatencyMs: 200_000,
    totalCostUsd: 5.0,
    ...overrides,
  };
}

describe("BenchmarkAgent", () => {
  it("detects improvement when current is better", async () => {
    const agent = new BenchmarkAgent();
    const baseline = makeSnap({ label: "before", successfulRuns: 70 });
    const current = makeSnap({ label: "after", successfulRuns: 95 });
    const result = await agent.execute({ baseline, current }, makeCtx());
    expect(result.output!.verdict).toBe("improved");
    expect(result.output!.improvementScore).toBeGreaterThan(0);
  });

  it("detects regression when current is worse", async () => {
    const agent = new BenchmarkAgent();
    const baseline = makeSnap({
      label: "before",
      successfulRuns: 90,
      patchesApproved: 45,
      regressionsIntroduced: 1,
      totalLatencyMs: 100_000,
      totalCostUsd: 2.0,
    });
    const current = makeSnap({
      label: "after",
      successfulRuns: 50,
      patchesApproved: 20,
      regressionsIntroduced: 10,
      totalLatencyMs: 500_000,
      totalCostUsd: 15.0,
    });
    const result = await agent.execute({ baseline, current }, makeCtx());
    expect(result.output!.verdict).toBe("regressed");
    expect(result.output!.improvementScore).toBeLessThan(0);
  });

  it("reports mixed when some metrics improve and others regress", async () => {
    const agent = new BenchmarkAgent();
    const baseline = makeSnap({
      label: "before",
      successfulRuns: 70,
      regressionsIntroduced: 2,
    });
    const current = makeSnap({
      label: "after",
      successfulRuns: 95,        // improved
      regressionsIntroduced: 10, // regressed
    });
    const result = await agent.execute({ baseline, current }, makeCtx());
    expect(result.output!.verdict).toBe("mixed");
  });

  it("reports unchanged when snapshots are identical", async () => {
    const agent = new BenchmarkAgent();
    const snap = makeSnap({ label: "same" });
    const result = await agent.execute({ baseline: snap, current: { ...snap } }, makeCtx());
    expect(result.output!.verdict).toBe("unchanged");
    expect(result.output!.improvementScore).toBe(0);
  });

  it("computes rates correctly", async () => {
    const agent = new BenchmarkAgent();
    const snap = makeSnap({
      totalRuns: 200, successfulRuns: 150,
      patchesProposed: 100, patchesApproved: 75,
      issuesFixed: 50, regressionsIntroduced: 5,
      totalLatencyMs: 500_000, totalCostUsd: 10.0,
    });
    const result = await agent.execute({ baseline: snap, current: { ...snap, label: "after" } }, makeCtx());
    const rates = result.output!.rates.baseline;
    expect(rates.passRate).toBe(0.75);
    expect(rates.patchAcceptanceRate).toBe(0.75);
    expect(rates.regressionRate).toBe(0.1);
    expect(rates.avgTimeToFixMs).toBe(10_000);
    expect(rates.avgCostPerFix).toBe(0.2);
  });

  it("handles zero-division gracefully", async () => {
    const agent = new BenchmarkAgent();
    const empty = makeSnap({
      label: "empty",
      totalRuns: 0, successfulRuns: 0,
      patchesProposed: 0, patchesApproved: 0,
      issuesFixed: 0, regressionsIntroduced: 0,
      totalLatencyMs: 0, totalCostUsd: 0,
    });
    const result = await agent.execute({ baseline: empty, current: { ...empty, label: "also-empty" } }, makeCtx());
    expect(result.output!.rates.baseline.passRate).toBe(0);
    expect(result.output!.rates.baseline.avgCostPerFix).toBe(0);
  });

  it("produces a human-readable summary", async () => {
    const agent = new BenchmarkAgent();
    const baseline = makeSnap({ label: "v1" });
    const current = makeSnap({ label: "v2", successfulRuns: 95 });
    const result = await agent.execute({ baseline, current }, makeCtx());
    expect(result.output!.summary).toContain("v1");
    expect(result.output!.summary).toContain("v2");
    expect(result.output!.summary.length).toBeGreaterThan(20);
  });

  it("improvement score is bounded -100 to +100", async () => {
    const agent = new BenchmarkAgent();
    // All metrics better
    const baseline = makeSnap({
      label: "bad",
      successfulRuns: 10, patchesApproved: 5,
      regressionsIntroduced: 15, totalLatencyMs: 1_000_000,
      totalCostUsd: 50.0, issuesFixed: 5,
    });
    const current = makeSnap({
      label: "good",
      successfulRuns: 99, patchesApproved: 49,
      regressionsIntroduced: 0, totalLatencyMs: 50_000,
      totalCostUsd: 1.0, issuesFixed: 50,
    });
    const result = await agent.execute({ baseline, current }, makeCtx());
    expect(result.output!.improvementScore).toBeGreaterThanOrEqual(-100);
    expect(result.output!.improvementScore).toBeLessThanOrEqual(100);
  });

  it("deltas contain all 7 tracked metrics", async () => {
    const agent = new BenchmarkAgent();
    const snap = makeSnap();
    const result = await agent.execute({ baseline: snap, current: { ...snap, label: "c" } }, makeCtx());
    expect(result.output!.deltas).toHaveLength(7);
    const names = result.output!.deltas.map((d) => d.metric);
    expect(names).toContain("Pass Rate");
    expect(names).toContain("Patch Acceptance Rate");
    expect(names).toContain("Regression Rate");
  });
});
