/**
 * SafetyGateAgent — blocks dangerous agent operations.
 *
 * Policy engine that evaluates a proposed action against safety rules:
 *   - Protected file patterns (secrets, CI, deploy configs)
 *   - Scope limits (max files per patch, max LOC changed)
 *   - Risk assessment (high-risk actions need explicit approval)
 *   - Secret detection in diffs (API keys, tokens, passwords)
 *
 * Returns allow/block verdict with reasons. Never mutates files.
 */

import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SafetyGateInput {
  /** Files being modified (repo-relative paths) */
  files: string[];
  /** Unified diff content */
  diff: string;
  /** Agent ID requesting the action */
  agentId: string;
  /** Risk level declared by the agent */
  declaredRisk: "low" | "medium" | "high";
  /** Custom policy overrides */
  policy?: Partial<SafetyPolicy>;
}

export interface SafetyPolicy {
  /** Max files per patch. Default: 10 */
  maxFiles: number;
  /** Max lines changed per patch. Default: 500 */
  maxLinesChanged: number;
  /** Protected file patterns (glob-like). Default: secrets, CI, deploy */
  protectedPatterns: string[];
  /** Whether high-risk actions auto-block (require human approval). Default: true */
  blockHighRisk: boolean;
}

export interface SafetyViolation {
  rule: string;
  severity: "block" | "warn";
  message: string;
  file?: string;
}

export interface SafetyGateOutput {
  /** Overall verdict */
  verdict: "allow" | "block" | "needs-approval";
  /** All violations found */
  violations: SafetyViolation[];
  /** Blocking violations (subset) */
  blockers: SafetyViolation[];
  /** Warnings (non-blocking) */
  warnings: SafetyViolation[];
  /** Effective policy used */
  policy: SafetyPolicy;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default policy
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_POLICY: SafetyPolicy = {
  maxFiles: 10,
  maxLinesChanged: 500,
  protectedPatterns: [
    ".env*",
    "*.pem",
    "*.key",
    "credentials*",
    "secret*",
    ".github/workflows/*",
    "Dockerfile*",
    "docker-compose*",
    "supabase/migrations/*",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
  ],
  blockHighRisk: true,
};

// Secret detection patterns
const SECRET_PATTERNS = [
  /(?:api[_-]?key|apikey)\s*[:=]\s*["'][^"']{8,}/i,
  /(?:secret|password|passwd|token)\s*[:=]\s*["'][^"']{8,}/i,
  /(?:AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/,           // AWS
  /ghp_[A-Za-z0-9_]{36}/,                                                 // GitHub PAT
  /sk-[A-Za-z0-9]{32,}/,                                                  // OpenAI
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,      // JWT
];

export class SafetyGateAgent extends BaseAgentV6<SafetyGateInput, SafetyGateOutput> {
  readonly id = "safety.gate";
  readonly name = "Safety Gate";
  readonly fleet: FleetName = "safety";
  readonly role = "validator" as const;
  readonly description = "Evaluates proposed agent actions against safety rules";

  protected async run(
    input: SafetyGateInput,
    ctx: AgentContextV6,
  ): Promise<{ output: SafetyGateOutput; evidence?: string[] }> {
    const policy: SafetyPolicy = { ...DEFAULT_POLICY, ...(input.policy ?? {}) };
    const violations: SafetyViolation[] = [];

    // Rule 1: Max files
    if (input.files.length > policy.maxFiles) {
      violations.push({
        rule: "max-files",
        severity: "block",
        message: `Patch modifies ${input.files.length} files (limit: ${policy.maxFiles})`,
      });
    }

    // Rule 2: Max lines changed
    const addedLines = (input.diff.match(/^\+[^+]/gm) ?? []).length;
    const removedLines = (input.diff.match(/^-[^-]/gm) ?? []).length;
    const totalChanged = addedLines + removedLines;
    if (totalChanged > policy.maxLinesChanged) {
      violations.push({
        rule: "max-lines",
        severity: "block",
        message: `Patch changes ${totalChanged} lines (limit: ${policy.maxLinesChanged})`,
      });
    }

    // Rule 3: Protected files
    for (const file of input.files) {
      if (matchesProtected(file, policy.protectedPatterns)) {
        violations.push({
          rule: "protected-file",
          severity: "block",
          message: `File "${file}" is protected by policy`,
          file,
        });
      }
    }

    // Rule 4: Secret detection in diff (only check added lines)
    const addedContent = input.diff
      .split("\n")
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
      .join("\n");

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(addedContent)) {
        violations.push({
          rule: "secret-leak",
          severity: "block",
          message: `Potential secret/credential detected in diff (pattern: ${pattern.source.slice(0, 30)}...)`,
        });
        break; // one secret violation is enough
      }
    }

    // Rule 5: High-risk + block policy
    if (input.declaredRisk === "high" && policy.blockHighRisk) {
      violations.push({
        rule: "high-risk",
        severity: "warn",
        message: `Agent "${input.agentId}" declared high risk — requires human approval`,
      });
    }

    const blockers = violations.filter((v) => v.severity === "block");
    const warnings = violations.filter((v) => v.severity === "warn");

    let verdict: SafetyGateOutput["verdict"];
    if (blockers.length > 0) {
      verdict = "block";
    } else if (warnings.length > 0) {
      verdict = "needs-approval";
    } else {
      verdict = "allow";
    }

    ctx.logger.info(
      `[safety-gate] agent=${input.agentId} verdict=${verdict} blockers=${blockers.length} warnings=${warnings.length}`,
    );

    return {
      output: { verdict, violations, blockers, warnings, policy },
      evidence: [`verdict=${verdict}`, `agent=${input.agentId}`, `blockers=${blockers.length}`],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Simple glob-like matching (supports * wildcard) */
function matchesProtected(file: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const regex = new RegExp(
      "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
    );
    if (regex.test(file)) return true;
  }
  return false;
}
