/**
 * sdk/types.ts — Public SDK Types
 *
 * Type definitions for the Desygn AI plugin authoring surface.
 */

import type { CheckResult, ChecklistCriterion } from "../shared/schemas/index";

// ═══════════════════════════════════════════════════════════════════════════════
// Plugin Manifest
// ═══════════════════════════════════════════════════════════════════════════════

export interface PluginManifest {
  /** Unique plugin ID, e.g., "acme.brand-checker" */
  id: string;
  /** Human-readable name shown in the UI */
  name: string;
  /** Semantic version (semver) */
  version: string;
  /** Short description (1-2 sentences) */
  description: string;
  /** Author name or org */
  author: string;
  /** Homepage URL (optional) */
  homepage?: string;
  /** Supported Desygn AI host versions, e.g., ">=5.0.0" */
  hostVersion?: string;
  /** Permissions the plugin requests */
  permissions?: PluginPermission[];
  /** Custom criteria, agents, and checks provided by this plugin */
  contributes: {
    criteria?: CustomCriterion[];
    agents?: CustomAgent[];
    checks?: CustomCheck[];
  };
}

export type PluginPermission =
  | "audit:read"
  | "audit:write"
  | "project:read"
  | "github:create-issue"
  | "github:read";

// ═══════════════════════════════════════════════════════════════════════════════
// Plugin Context (passed to plugin lifecycle hooks)
// ═══════════════════════════════════════════════════════════════════════════════

export interface PluginContext {
  /** Plugin's own ID */
  pluginId: string;
  /** Project the plugin is operating in */
  projectId: string;
  /** User ID (if authenticated) */
  userId?: string;
  /** Host Desygn AI version */
  hostVersion: string;
  /** Logger scoped to this plugin */
  logger: {
    debug: (msg: string, meta?: Record<string, unknown>) => void;
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
  /** Storage scoped to this plugin (KV) */
  storage: {
    get: <T = unknown>(key: string) => Promise<T | null>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Custom Agents
// ═══════════════════════════════════════════════════════════════════════════════

export type AgentRole = "audit" | "accessibility" | "design-system" | "scoring" | "recommend" | "custom";

export interface AgentInput {
  /** Audit run ID */
  auditRunId: string;
  /** Design context to analyze */
  designContext: unknown;
  /** Previous results in this run (if any) */
  previousResults?: CheckResult[];
}

export interface AgentOutput {
  /** Whether the agent ran successfully */
  success: boolean;
  /** Structured output (criteria-specific) */
  output: unknown;
  /** Cost in USD (optional, for cost tracking) */
  costUsd?: number;
  /** Latency in ms (auto-measured if omitted) */
  latencyMs?: number;
  /** Error message if success=false */
  error?: string;
}

export interface CustomAgent {
  /** Unique agent ID, e.g., "acme.brand-audit" */
  id: string;
  /** Human-readable name */
  name: string;
  /** Agent role / category */
  role: AgentRole;
  /** Short description */
  description?: string;
  /** Execute function */
  execute: (input: AgentInput, ctx: PluginContext) => Promise<AgentOutput>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Custom Criteria & Checks
// ═══════════════════════════════════════════════════════════════════════════════

export interface CustomCriterion extends ChecklistCriterion {
  /** Optional default check function bundled with the criterion */
  check?: CheckFunction;
}

export type CheckFunction = (
  designContext: unknown,
  ctx: PluginContext,
) => Promise<CheckResult> | CheckResult;

export interface CustomCheck {
  /** Criterion ID this check implements */
  criterionId: string;
  /** Check function */
  check: CheckFunction;
}
