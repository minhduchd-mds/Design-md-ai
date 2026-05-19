/**
 * HumanCommandAgent — parses user commands into structured missions.
 *
 * The "conductor" interface: user types a natural-language or structured command,
 * this agent produces a Mission with scope, target fleet, policy constraints.
 *
 * Command patterns (v0 — deterministic, no LLM):
 *   "audit src/components"      → audit fleet, scope=src/components
 *   "fix any types"             → self-improve + fix fleet
 *   "check accessibility"       → audit fleet, a11y scope
 *   "test src/lib"              → verify fleet
 *   "map repo"                  → map fleet
 *   "scan design MyFrame"       → map fleet (design context)
 *   "benchmark agents"          → self-improve fleet
 *
 * Future: LLM integration for intent classification.
 */

import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HumanCommandInput {
  /** Raw command text from the user */
  command: string;
  /** Optional context: current file, selection, etc */
  context?: {
    currentFile?: string;
    selectedComponent?: string;
    figmaNodeId?: string;
  };
}

export type MissionType =
  | "audit"
  | "fix"
  | "test"
  | "lint"
  | "map-repo"
  | "trace-component"
  | "scan-design"
  | "benchmark"
  | "self-audit"
  | "dependency-check"
  | "unknown";

export interface Mission {
  /** Unique mission ID */
  id: string;
  /** Parsed mission type */
  type: MissionType;
  /** Target fleets to activate */
  fleets: FleetName[];
  /** Scope: files, directories, or components to target */
  scope: string[];
  /** Policy constraints */
  policy: MissionPolicy;
  /** Original command */
  rawCommand: string;
  /** Confidence of parsing (0-1) */
  confidence: number;
}

export interface MissionPolicy {
  /** Max cost in USD */
  maxCostUsd: number;
  /** Whether to require human approval before applying fixes */
  requireApproval: boolean;
  /** Whether to use worktree isolation */
  useWorktree: boolean;
  /** Risk tolerance: only run agents at or below this risk */
  maxRisk: "low" | "medium" | "high";
}

export interface HumanCommandOutput {
  /** Parsed mission */
  mission: Mission;
  /** Human-readable summary of what will happen */
  summary: string;
  /** Suggested follow-up commands */
  suggestions: string[];
}

export class HumanCommandAgent extends BaseAgentV6<HumanCommandInput, HumanCommandOutput> {
  readonly id = "command.human";
  readonly name = "Human Command";
  readonly fleet: FleetName = "command";
  readonly role = "analyzer" as const;
  readonly description = "Parses user commands into structured missions with scope and policy";

  private _seq = 0;

  protected async run(
    input: HumanCommandInput,
    ctx: AgentContextV6,
  ): Promise<{ output: HumanCommandOutput }> {
    const cmd = input.command.trim().toLowerCase();
    const tokens = cmd.split(/\s+/);

    const parsed = parseCommand(tokens, cmd, input.context);

    const mission: Mission = {
      id: `mission-${ctx.runId}-${Date.now()}-${this._seq++}`,
      type: parsed.type,
      fleets: parsed.fleets,
      scope: parsed.scope,
      policy: {
        maxCostUsd: ctx.costBudgetUsd,
        requireApproval: parsed.type === "fix" || parsed.type === "self-audit",
        useWorktree: parsed.fleets.includes("fix"),
        maxRisk: parsed.type === "fix" ? "medium" : "high",
      },
      rawCommand: input.command,
      confidence: parsed.confidence,
    };

    const summary = buildSummary(mission);
    const suggestions = buildSuggestions(mission);

    ctx.logger.info(`[human-command] "${input.command}" → ${mission.type} (${mission.confidence.toFixed(2)})`);

    return {
      output: { mission, summary, suggestions },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Command parsing (deterministic v0)
// ─────────────────────────────────────────────────────────────────────────────

interface ParseResult {
  type: MissionType;
  fleets: FleetName[];
  scope: string[];
  confidence: number;
}

const COMMAND_PATTERNS: { keywords: string[]; type: MissionType; fleets: FleetName[] }[] = [
  { keywords: ["audit", "scan", "check", "review"], type: "audit", fleets: ["audit", "verify"] },
  { keywords: ["fix", "repair", "patch", "refactor"], type: "fix", fleets: ["self-improve", "fix", "safety"] },
  { keywords: ["test", "run test", "vitest"], type: "test", fleets: ["verify"] },
  { keywords: ["lint", "eslint"], type: "lint", fleets: ["verify"] },
  { keywords: ["map", "index", "repo map"], type: "map-repo", fleets: ["map"] },
  { keywords: ["trace", "find component", "locate"], type: "trace-component", fleets: ["map"] },
  { keywords: ["design", "figma", "scan design"], type: "scan-design", fleets: ["map"] },
  { keywords: ["benchmark", "measure", "score agent"], type: "benchmark", fleets: ["self-improve"] },
  { keywords: ["self-audit", "agent health", "agent quality"], type: "self-audit", fleets: ["self-improve"] },
  { keywords: ["dependency", "deps", "npm audit", "outdated"], type: "dependency-check", fleets: ["self-improve"] },
  { keywords: ["accessibility", "a11y", "wcag"], type: "audit", fleets: ["audit"] },
  { keywords: ["any", "unknown", "type safety", "typescript"], type: "fix", fleets: ["self-improve", "fix"] },
];

function parseCommand(
  tokens: string[],
  fullCmd: string,
  context?: HumanCommandInput["context"],
): ParseResult {
  // Try each pattern
  for (const pattern of COMMAND_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (fullCmd.includes(keyword)) {
        const scope = extractScope(tokens, fullCmd, context);
        return {
          type: pattern.type,
          fleets: pattern.fleets,
          scope,
          confidence: keyword.length > 3 ? 0.9 : 0.7,
        };
      }
    }
  }

  // Fallback: unknown
  return {
    type: "unknown",
    fleets: ["audit"],
    scope: extractScope(tokens, fullCmd, context),
    confidence: 0.3,
  };
}

function extractScope(
  tokens: string[],
  _fullCmd: string,
  context?: HumanCommandInput["context"],
): string[] {
  const scope: string[] = [];

  // Look for file paths in tokens
  for (const t of tokens) {
    if (t.includes("/") || t.includes(".ts") || t.includes(".tsx") || t.includes("src")) {
      scope.push(t);
    }
  }

  // Add context
  if (context?.currentFile && scope.length === 0) {
    scope.push(context.currentFile);
  }
  if (context?.selectedComponent) {
    scope.push(context.selectedComponent);
  }

  return scope.length > 0 ? scope : ["."]; // default: entire repo
}

function buildSummary(mission: Mission): string {
  const fleetStr = mission.fleets.join(", ");
  const scopeStr = mission.scope.join(", ");
  const typeLabels: Record<MissionType, string> = {
    "audit": "Running design & code audit",
    "fix": "Finding issues and generating fixes",
    "test": "Running test suite",
    "lint": "Running linter",
    "map-repo": "Indexing repository structure",
    "trace-component": "Tracing component from design to code",
    "scan-design": "Scanning design system context",
    "benchmark": "Benchmarking agent performance",
    "self-audit": "Auditing agent system health",
    "dependency-check": "Checking dependencies for vulnerabilities",
    "unknown": "Processing command",
  };

  return `${typeLabels[mission.type]} on [${scopeStr}] using fleets: ${fleetStr}${
    mission.policy.requireApproval ? " (approval required)" : ""
  }`;
}

function buildSuggestions(mission: Mission): string[] {
  const suggestions: string[] = [];
  if (mission.type === "audit") {
    suggestions.push("fix issues found", "benchmark before/after");
  }
  if (mission.type === "fix") {
    suggestions.push("test after fix", "audit to verify");
  }
  if (mission.type === "map-repo") {
    suggestions.push("trace component Button", "audit src/components");
  }
  if (mission.type === "unknown") {
    suggestions.push("audit src", "fix any types", "map repo", "test");
  }
  return suggestions;
}
