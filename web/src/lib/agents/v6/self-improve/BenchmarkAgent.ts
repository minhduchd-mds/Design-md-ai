/**
 * BenchmarkAgent — measures agent effectiveness before/after changes.
 *
 * Compares two snapshots of agent metrics (e.g. before and after a prompt
 * change, code fix, or rule update) and reports improvement/regression.
 *
 * Metrics:
 *   - Pass rate (success / total)
 *   - Patch acceptance rate (approved / proposed)
 *   - Regression rate (regressions / fixes)
 *   - Avg time-to-fix (ms)
 *   - Cost per fix (USD)
 */

import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricSnapshot {
  label: string;        // "before" or "after" or timestamp
  timestamp: number;
  /** Agent execution metrics */
  totalRuns: number;
  successfulRuns: number;
  /** Patch metrics */
  patchesProposed: number;
  patchesApproved: number;
  patchesRejected: number;
  /** Quality metrics */
  regressionsIntroduced: number;
  issuesFixed: number;
  /** Performance metrics */
  totalLatencyMs: number;
  totalCostUsd: number;
}

export interface BenchmarkInput {
  /** Baseline snapshot ("before") */
  baseline: MetricSnapshot;
  /** Current snapshot ("after") */
  current: MetricSnapshot;
}

export interface MetricDelta {
  metric: string;
  baseline: number;
  current: number;
  delta: number;
  deltaPercent: number;
  /** "improved" | "regressed" | "unchanged" */
  direction: "improved" | "regressed" | "unchanged";
}

export interface BenchmarkOutput {
  /** All metric comparisons */
  deltas: MetricDelta[];
  /** Overall assessment */
  verdict: "improved" | "regressed" | "mixed" | "unchanged";
  /** Improvement score: -100 (total regression) to +100 (total improvement) */
  improvementScore: number;
  /** Human-readable summary */
  summary: string;
  /** Computed rates for both snapshots */
  rates: {
    baseline: ComputedRates;
    current: ComputedRates;
  };
}

export interface ComputedRates {
  passRate: number;
  patchAcceptanceRate: number;
  regressionRate: number;
  avgTimeToFixMs: number;
  avgCostPerFix: number;
}

export class BenchmarkAgent extends BaseAgentV6<BenchmarkInput, BenchmarkOutput> {
  readonly id = "self-improve.benchmark";
  readonly name = "Benchmark";
  readonly fleet: FleetName = "self-improve";
  readonly role = "analyzer" as const;
  readonly description = "Compares agent metrics before/after to measure improvement";

  protected async run(
    input: BenchmarkInput,
    ctx: AgentContextV6,
  ): Promise<{ output: BenchmarkOutput; evidence?: string[] }> {
    const { baseline, current } = input;

    const baseRates = computeRates(baseline);
    const currRates = computeRates(current);

    const deltas: MetricDelta[] = [
      makeDelta("Pass Rate", baseRates.passRate, currRates.passRate, true),
      makeDelta("Patch Acceptance Rate", baseRates.patchAcceptanceRate, currRates.patchAcceptanceRate, true),
      makeDelta("Regression Rate", baseRates.regressionRate, currRates.regressionRate, false),
      makeDelta("Avg Time-to-Fix (ms)", baseRates.avgTimeToFixMs, currRates.avgTimeToFixMs, false),
      makeDelta("Avg Cost per Fix ($)", baseRates.avgCostPerFix, currRates.avgCostPerFix, false),
      makeDelta("Total Runs", baseline.totalRuns, current.totalRuns, true),
      makeDelta("Issues Fixed", baseline.issuesFixed, current.issuesFixed, true),
    ];

    // Compute improvement score (-100 to +100)
    let improvementScore = 0;
    const weights = [3, 2, 3, 1, 1, 0, 1]; // weighted by importance
    let totalWeight = 0;
    for (let i = 0; i < deltas.length; i++) {
      const d = deltas[i];
      const w = weights[i];
      if (d.direction === "improved") improvementScore += w;
      if (d.direction === "regressed") improvementScore -= w;
      totalWeight += w;
    }
    improvementScore = totalWeight > 0
      ? Math.round((improvementScore / totalWeight) * 100)
      : 0;

    const improved = deltas.filter((d) => d.direction === "improved").length;
    const regressed = deltas.filter((d) => d.direction === "regressed").length;

    let verdict: BenchmarkOutput["verdict"];
    if (improved > 0 && regressed === 0) verdict = "improved";
    else if (regressed > 0 && improved === 0) verdict = "regressed";
    else if (improved > 0 && regressed > 0) verdict = "mixed";
    else verdict = "unchanged";

    const summary = buildSummary(deltas, verdict, improvementScore, baseline, current);

    ctx.logger.info(
      `[benchmark] ${baseline.label} → ${current.label}: verdict=${verdict}, score=${improvementScore}`,
    );

    return {
      output: {
        deltas,
        verdict,
        improvementScore,
        summary,
        rates: { baseline: baseRates, current: currRates },
      },
      evidence: [`verdict=${verdict}`, `score=${improvementScore}`],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeRates(snap: MetricSnapshot): ComputedRates {
  return {
    passRate: snap.totalRuns > 0 ? snap.successfulRuns / snap.totalRuns : 0,
    patchAcceptanceRate: snap.patchesProposed > 0
      ? snap.patchesApproved / snap.patchesProposed
      : 0,
    regressionRate: snap.issuesFixed > 0
      ? snap.regressionsIntroduced / snap.issuesFixed
      : 0,
    avgTimeToFixMs: snap.issuesFixed > 0
      ? snap.totalLatencyMs / snap.issuesFixed
      : 0,
    avgCostPerFix: snap.issuesFixed > 0
      ? snap.totalCostUsd / snap.issuesFixed
      : 0,
  };
}

function makeDelta(
  metric: string,
  baseline: number,
  current: number,
  higherIsBetter: boolean,
): MetricDelta {
  const delta = current - baseline;
  const deltaPercent = baseline !== 0 ? (delta / baseline) * 100 : (current !== 0 ? 100 : 0);

  let direction: MetricDelta["direction"];
  const threshold = 0.01; // 1% change threshold
  if (Math.abs(deltaPercent) < threshold * 100 && Math.abs(delta) < threshold) {
    direction = "unchanged";
  } else if (higherIsBetter) {
    direction = delta > 0 ? "improved" : "regressed";
  } else {
    direction = delta < 0 ? "improved" : "regressed";
  }

  return {
    metric,
    baseline: Math.round(baseline * 10000) / 10000,
    current: Math.round(current * 10000) / 10000,
    delta: Math.round(delta * 10000) / 10000,
    deltaPercent: Math.round(deltaPercent * 100) / 100,
    direction,
  };
}

function buildSummary(
  deltas: MetricDelta[],
  verdict: string,
  score: number,
  baseline: MetricSnapshot,
  current: MetricSnapshot,
): string {
  const improved = deltas.filter((d) => d.direction === "improved").map((d) => d.metric);
  const regressed = deltas.filter((d) => d.direction === "regressed").map((d) => d.metric);

  let summary = `Benchmark ${baseline.label} → ${current.label}: ${verdict} (score: ${score}).`;
  if (improved.length > 0) summary += ` Improved: ${improved.join(", ")}.`;
  if (regressed.length > 0) summary += ` Regressed: ${regressed.join(", ")}.`;

  return summary;
}
