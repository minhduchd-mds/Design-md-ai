/**
 * ux-checklist/agents/index.ts — Agent Package Barrel
 *
 * Re-exports all agents, types, and registry helpers.
 * Import from this file for any consumer of the agent system.
 *
 * @example
 * ```ts
 * import { DesignAuditAgent, getAgentConfigs, SPECIALIZED_AGENTS } from './agents';
 * ```
 */

// ── Types & Base Class ─────────────────────────────────────────
export type {
  AgentRole,
  AgentConfig,
  AgentContext,
  AgentExecutionResult,
  FixPlan,
  FixPlanStep,
  GitHubIssuePayload,
} from "./types";
export { BaseAgent } from "./types";

// ── Specialized Agents ─────────────────────────────────────────
export { DesignAuditAgent } from "./DesignAuditAgent";
export { AccessibilityAgent } from "./AccessibilityAgent";
export { DesignSystemAgent } from "./DesignSystemAgent";
export { FixPlannerAgent } from "./FixPlannerAgent";
export { IssueWriterAgent } from "./IssueWriterAgent";

// ── Agent Registry ─────────────────────────────────────────────

import { DesignAuditAgent } from "./DesignAuditAgent";
import { AccessibilityAgent } from "./AccessibilityAgent";
import { DesignSystemAgent } from "./DesignSystemAgent";
import { FixPlannerAgent } from "./FixPlannerAgent";
import { IssueWriterAgent } from "./IssueWriterAgent";
import type { AgentConfig, AgentContext, AgentExecutionResult } from "./types";

/**
 * Registry of all specialized agents for Shannon Engine integration.
 * Use `getAgentConfigs()` to register all agents with the orchestrator.
 */
export const SPECIALIZED_AGENTS = {
  designAudit: new DesignAuditAgent(),
  accessibility: new AccessibilityAgent(),
  designSystem: new DesignSystemAgent(),
  fixPlanner: new FixPlannerAgent(),
  issueWriter: new IssueWriterAgent(),
} as const;

/**
 * Get all agent configurations for Shannon Engine registration.
 * @returns Array of AgentConfig objects ready for orchestrator registration
 */
export function getAgentConfigs(): AgentConfig[] {
  return Object.values(SPECIALIZED_AGENTS).map((agent) => agent.toConfig());
}

/**
 * Execute a specific agent by ID.
 * @param agentId - The agent's unique identifier
 * @param input - Input data for the agent
 * @param context - Execution context
 * @returns AgentExecutionResult or null if agent not found
 */
export async function executeAgent(
  agentId: string,
  input: unknown,
  context: AgentContext,
): Promise<AgentExecutionResult | null> {
  const agent = Object.values(SPECIALIZED_AGENTS).find((a) => a.id === agentId);
  if (!agent) return null;
  return agent.execute(input, context);
}
