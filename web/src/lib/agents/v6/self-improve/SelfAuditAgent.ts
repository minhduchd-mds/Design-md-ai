/**
 * SelfAuditAgent — audits the agent system's own health and quality.
 *
 * Unlike SelfDiagnosticAgent (which scans code), this agent evaluates
 * the agent fleet itself:
 *   - Agent run success rates
 *   - Average latency per agent
 *   - Cost efficiency (cost vs. value produced)
 *   - Recurring failures (same agent failing repeatedly)
 *   - Coverage gaps (issues found but never fixed)
 *
 * Reads from agent run history (AgentRunRecord[]).
 */

import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentRunRecord {
  agentId: string;
  runId: string;
  success: boolean;
  costUsd: number;
  latencyMs: number;
  error?: string;
  timestamp: number;
}

export interface SelfAuditInput {
  /** Historical agent run records */
  runs: AgentRunRecord[];
  /** Minimum runs to consider an agent auditable. Default: 3 */
  minRuns?: number;
}

export interface AgentHealthReport {
  agentId: string;
  totalRuns: number;
  successRate: number;       // 0-1
  avgLatencyMs: number;
  totalCostUsd: number;
  avgCostPerRun: number;
  failureCount: number;
  /** Most common error message (if any) */
  topError: string | null;
  /** Health grade: A (>90%), B (>75%), C (>50%), D (>25%), F */
  grade: "A" | "B" | "C" | "D" | "F";
}

export interface SelfAuditOutput {
  /** Per-agent health reports */
  reports: AgentHealthReport[];
  /** Overall fleet health score (0-100) */
  fleetHealthScore: number;
  /** Agents that need attention (grade C or worse) */
  needsAttention: string[];
  /** Agents with recurring failures (>3 consecutive) */
  recurringFailures: string[];
  /** Recommendations */
  recommendations: string[];
  /** Stats */
  stats: {
    totalRuns: number;
    totalCostUsd: number;
    overallSuccessRate: number;
    avgLatencyMs: number;
  };
}

export class SelfAuditAgent extends BaseAgentV6<SelfAuditInput, SelfAuditOutput> {
  readonly id = "self-improve.self-audit";
  readonly name = "Self Audit";
  readonly fleet: FleetName = "self-improve";
  readonly role = "analyzer" as const;
  readonly description = "Audits the agent fleet health, success rates, and cost efficiency";

  protected async run(
    input: SelfAuditInput,
    ctx: AgentContextV6,
  ): Promise<{ output: SelfAuditOutput }> {
    const minRuns = input.minRuns ?? 3;
    const runs = input.runs;

    // Group runs by agent
    const byAgent = new Map<string, AgentRunRecord[]>();
    for (const run of runs) {
      const arr = byAgent.get(run.agentId) ?? [];
      arr.push(run);
      byAgent.set(run.agentId, arr);
    }

    const reports: AgentHealthReport[] = [];

    for (const [agentId, agentRuns] of byAgent) {
      if (agentRuns.length < minRuns) continue;

      const successCount = agentRuns.filter((r) => r.success).length;
      const successRate = successCount / agentRuns.length;
      const avgLatencyMs = agentRuns.reduce((s, r) => s + r.latencyMs, 0) / agentRuns.length;
      const totalCostUsd = agentRuns.reduce((s, r) => s + r.costUsd, 0);
      const failureCount = agentRuns.length - successCount;

      // Find most common error
      const errorCounts = new Map<string, number>();
      for (const r of agentRuns) {
        if (r.error) {
          const key = r.error.slice(0, 100);
          errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
        }
      }
      let topError: string | null = null;
      let topErrorCount = 0;
      for (const [err, count] of errorCounts) {
        if (count > topErrorCount) {
          topError = err;
          topErrorCount = count;
        }
      }

      const grade = gradeFromRate(successRate);

      reports.push({
        agentId,
        totalRuns: agentRuns.length,
        successRate,
        avgLatencyMs: Math.round(avgLatencyMs),
        totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
        avgCostPerRun: Math.round((totalCostUsd / agentRuns.length) * 10000) / 10000,
        failureCount,
        topError,
        grade,
      });
    }

    // Sort by grade (worst first)
    const gradeOrder = { F: 0, D: 1, C: 2, B: 3, A: 4 };
    reports.sort((a, b) => gradeOrder[a.grade] - gradeOrder[b.grade]);

    const needsAttention = reports.filter((r) => gradeOrder[r.grade] <= 2).map((r) => r.agentId);
    const recurringFailures = findRecurringFailures(runs);

    // Overall stats
    const totalCostUsd = runs.reduce((s, r) => s + r.costUsd, 0);
    const overallSuccessRate = runs.length > 0
      ? runs.filter((r) => r.success).length / runs.length
      : 1;
    const avgLatencyMs = runs.length > 0
      ? Math.round(runs.reduce((s, r) => s + r.latencyMs, 0) / runs.length)
      : 0;

    const fleetHealthScore = Math.round(
      reports.length > 0
        ? (reports.reduce((s, r) => s + r.successRate * 100, 0) / reports.length)
        : 100,
    );

    const recommendations = buildRecommendations(reports, recurringFailures, overallSuccessRate);

    ctx.logger.info(
      `[self-audit] fleet health=${fleetHealthScore}%, ${reports.length} agents audited, ${needsAttention.length} need attention`,
    );

    return {
      output: {
        reports,
        fleetHealthScore,
        needsAttention,
        recurringFailures,
        recommendations,
        stats: {
          totalRuns: runs.length,
          totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
          overallSuccessRate: Math.round(overallSuccessRate * 1000) / 1000,
          avgLatencyMs,
        },
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function gradeFromRate(rate: number): AgentHealthReport["grade"] {
  if (rate >= 0.9) return "A";
  if (rate >= 0.75) return "B";
  if (rate >= 0.5) return "C";
  if (rate >= 0.25) return "D";
  return "F";
}

/** Find agents with 3+ consecutive failures */
function findRecurringFailures(runs: AgentRunRecord[]): string[] {
  const sorted = [...runs].sort((a, b) => a.timestamp - b.timestamp);
  const byAgent = new Map<string, boolean[]>();
  for (const r of sorted) {
    const arr = byAgent.get(r.agentId) ?? [];
    arr.push(r.success);
    byAgent.set(r.agentId, arr);
  }

  const recurring: string[] = [];
  for (const [agentId, results] of byAgent) {
    let consecutive = 0;
    for (const success of results) {
      if (!success) {
        consecutive++;
        if (consecutive >= 3) {
          recurring.push(agentId);
          break;
        }
      } else {
        consecutive = 0;
      }
    }
  }
  return recurring;
}

function buildRecommendations(
  reports: AgentHealthReport[],
  recurringFailures: string[],
  overallRate: number,
): string[] {
  const recs: string[] = [];

  for (const r of reports) {
    if (r.grade === "F") recs.push(`Disable or rewrite agent "${r.agentId}" (${Math.round(r.successRate * 100)}% success)`);
    if (r.grade === "D") recs.push(`Investigate agent "${r.agentId}" failures (top error: ${r.topError ?? "unknown"})`);
    if (r.avgLatencyMs > 30000) recs.push(`Optimize agent "${r.agentId}" latency (avg ${r.avgLatencyMs}ms)`);
    if (r.avgCostPerRun > 0.5) recs.push(`Review cost of agent "${r.agentId}" ($${r.avgCostPerRun}/run)`);
  }

  for (const agentId of recurringFailures) {
    if (!recs.some((r) => r.includes(agentId))) {
      recs.push(`Agent "${agentId}" has recurring failures — check logs`);
    }
  }

  if (overallRate < 0.8) {
    recs.push("Overall fleet success rate below 80% — consider reducing scope or adding fallbacks");
  }

  return recs.slice(0, 10); // max 10 recommendations
}
