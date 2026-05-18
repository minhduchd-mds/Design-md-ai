/**
 * ux-checklist/agents/types.ts — Shared Agent Types & Interfaces
 *
 * All agent interfaces, base types, and shared type definitions
 * for the specialized agentic auditor system.
 *
 * Aligned with Shannon Engine's AgentConfig registration pattern.
 */

import type {
  AuditResult,
  AuditCriterion,
} from "../index";

export type { AuditResult, AuditCriterion };

// ── Agent Role Types ──────────────────────────────────────────

/** Shannon Engine agent role classification */
export type AgentRole =
  | "analyzer"
  | "generator"
  | "validator"
  | "optimizer"
  | "orchestrator";

// ── Shared Types ──────────────────────────────────────────────

/**
 * A single step within a fix plan, describing what to change,
 * which element to target, and the associated risk level.
 */
export interface FixPlanStep {
  /** The action to perform (e.g., "increase contrast ratio") */
  action: string;
  /** The target element or file (e.g., "Button.primary background") */
  target: string;
  /** Risk level of this change */
  risk: "low" | "medium" | "high";
}

/**
 * A structured fix plan generated from a failed audit criterion.
 * Describes what needs to change, how long it will take, and
 * whether automation can handle it.
 */
export interface FixPlan {
  /** The criterion that failed */
  criterionId: string;
  /** Human-readable title for the fix */
  title: string;
  /** Ordered steps to resolve the issue */
  steps: FixPlanStep[];
  /** Estimated time to complete all steps */
  estimatedMinutes: number;
  /** Whether this fix can be applied automatically */
  automated: boolean;
  /** Optional code-level changes required */
  codeChanges?: Array<{ file: string; description: string }>;
}

/**
 * Structured payload for creating a GitHub issue from a failed
 * audit criterion. Includes all metadata needed for triage.
 */
export interface GitHubIssuePayload {
  /** Issue title (concise, actionable) */
  title: string;
  /** Markdown issue body with full context */
  body: string;
  /** Labels to apply (e.g., ["accessibility", "design-system"]) */
  labels: string[];
  /** Priority for triage */
  priority: "critical" | "high" | "medium" | "low";
  /** Testable acceptance criteria */
  acceptanceCriteria: string[];
  /** Evidence references supporting the issue */
  evidence: Array<{ type: "screenshot" | "node" | "selector"; ref: string }>;
}

/**
 * Standardized result envelope returned by all agents.
 * Enables pipeline composition and telemetry tracking.
 */
export interface AgentExecutionResult {
  /** Which agent produced this result */
  agentId: string;
  /** Whether execution completed without errors */
  success: boolean;
  /** The typed output payload (varies by agent) */
  output: unknown;
  /** Agent's self-assessed confidence in the result (0-1) */
  confidence: number;
  /** Token count consumed (for cost tracking) */
  tokensUsed: number;
  /** Wall-clock execution time in milliseconds */
  latencyMs: number;
  /** IDs of evidence records supporting this result */
  evidenceRefs: string[];
}

// ── Agent Configuration ───────────────────────────────────────

/**
 * Shannon Engine AgentConfig registration shape.
 * Each agent registers itself with this metadata for orchestration.
 */
export interface AgentConfig {
  /** Unique agent identifier */
  id: string;
  /** Agent's functional role in the pipeline */
  role: AgentRole;
  /** List of capability strings for routing decisions */
  capabilities: string[];
  /** Human-readable description */
  description: string;
  /** Maximum concurrent executions allowed */
  maxConcurrency: number;
  /** Timeout in milliseconds before the agent is killed */
  timeoutMs: number;
}

/**
 * Context passed to agents during execution.
 * Provides access to shared state and configuration.
 */
export interface AgentContext {
  /** Project name being audited */
  projectName: string;
  /** All criteria available in the registry */
  criteria: AuditCriterion[];
  /** Previous audit results (for cross-referencing) */
  previousResults?: AuditResult[];
  /** Arbitrary metadata for agent-specific needs */
  metadata?: Record<string, unknown>;
}

// ── Base Agent ────────────────────────────────────────────────

/**
 * Abstract base class for all specialized agents.
 * Provides common execution wrapper with timing and error handling.
 */
export abstract class BaseAgent {
  abstract readonly id: string;
  abstract readonly role: AgentRole;
  abstract readonly capabilities: string[];
  abstract readonly description: string;

  /** Default timeout: 30 seconds */
  readonly timeoutMs = 30_000;
  /** Default concurrency: 1 */
  readonly maxConcurrency = 1;

  /**
   * Execute the agent's core logic with timing and error wrapping.
   * Subclasses implement `run()` for their specific logic.
   */
  async execute(input: unknown, context: AgentContext): Promise<AgentExecutionResult> {
    const start = performance.now();

    try {
      const result = await this.run(input, context);
      const latencyMs = Math.round(performance.now() - start);

      return {
        agentId: this.id,
        success: true,
        output: result.output,
        confidence: result.confidence,
        tokensUsed: result.tokensUsed,
        latencyMs,
        evidenceRefs: result.evidenceRefs,
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        agentId: this.id,
        success: false,
        output: { error: error instanceof Error ? error.message : "Unknown error" },
        confidence: 0,
        tokensUsed: 0,
        latencyMs,
        evidenceRefs: [],
      };
    }
  }

  /** Subclass-specific execution logic */
  protected abstract run(
    input: unknown,
    context: AgentContext,
  ): Promise<{
    output: unknown;
    confidence: number;
    tokensUsed: number;
    evidenceRefs: string[];
  }>;

  /** Get the AgentConfig for Shannon Engine registration */
  toConfig(): AgentConfig {
    return {
      id: this.id,
      role: this.role,
      capabilities: this.capabilities,
      description: this.description,
      maxConcurrency: this.maxConcurrency,
      timeoutMs: this.timeoutMs,
    };
  }
}
