/**
 * DesignContextAgent — bridges Figma design data into agent-consumable context.
 *
 * Transforms raw Figma scan results (ScanResult, DesignSystemSnapshot,
 * AccessibilityAudit) into a structured context that code-focused agents
 * can act on.
 *
 * Output is a DesignContext document suitable for:
 *   - RepoMapAgent (token → variable mapping)
 *   - ComponentTraceAgent (component names)
 *   - PatchGeneratorAgent/RefactorAgent (what to fix)
 *   - HumanCommandAgent (issue summary for the user)
 */

import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirrors shared/types.ts shapes (no direct import to keep server-only)
// ─────────────────────────────────────────────────────────────────────────────

export interface DesignIssue {
  id: string;
  category: string;     // "naming" | "structure" | "tokens" | "meta" | "completeness" | "variants"
  severity: string;     // "critical" | "warning" | "info"
  message: string;
  nodePath: string;     // Figma node path
  nodeId?: string;
  suggestion?: string;
}

export interface DesignComponent {
  name: string;
  nodeId?: string;
  type: string;         // "COMPONENT" | "COMPONENT_SET"
  role?: string;        // "navigation" | "kpi" | "chart" | etc
  variantCount?: number;
}

export interface DesignToken {
  name: string;
  collection: string;
  type: string;         // "COLOR" | "FLOAT" | "STRING" | "BOOLEAN"
  value: string;
}

export interface DesignContextInput {
  /** Figma file / page name */
  source: string;
  /** Overall design score (0-100) */
  score: number;
  /** Category scores */
  categoryScores?: Record<string, number>;
  /** All scan issues */
  issues: DesignIssue[];
  /** Components found in the design system */
  components?: DesignComponent[];
  /** Design tokens / variables */
  tokens?: DesignToken[];
  /** Accessibility score (0-100) */
  a11yScore?: number;
  /** Accessibility violations count */
  a11yViolations?: number;
}

export interface DesignContextOutput {
  /** Structured context document */
  context: DesignContextDocument;
  /** Component names extracted (for ComponentTraceAgent) */
  componentNames: string[];
  /** Token names extracted (for RepoMapAgent token mapping) */
  tokenNames: string[];
  /** Issues grouped by priority */
  prioritized: PrioritizedIssues;
}

export interface DesignContextDocument {
  source: string;
  generatedAt: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  a11y: { score: number; violations: number } | null;
  componentCount: number;
  tokenCount: number;
  issueCount: number;
  criticalCount: number;
  /** Top 20 actionable issues for agents */
  actionableIssues: ActionableIssue[];
}

export interface ActionableIssue {
  id: string;
  category: string;
  severity: string;
  message: string;
  componentName: string | null;
  tokenName: string | null;
  suggestedAction: string;
}

export interface PrioritizedIssues {
  critical: DesignIssue[];
  warning: DesignIssue[];
  info: DesignIssue[];
}

export class DesignContextAgent extends BaseAgentV6<DesignContextInput, DesignContextOutput> {
  readonly id = "map.design-context";
  readonly name = "Design Context";
  readonly fleet: FleetName = "map";
  readonly role = "analyzer" as const;
  readonly description = "Transforms Figma design data into agent-consumable context";

  protected async run(
    input: DesignContextInput,
    ctx: AgentContextV6,
  ): Promise<{ output: DesignContextOutput }> {
    const componentNames = (input.components ?? []).map((c) => c.name);
    const tokenNames = (input.tokens ?? []).map((t) => t.name);

    // Prioritize issues
    const prioritized: PrioritizedIssues = {
      critical: input.issues.filter((i) => i.severity === "critical"),
      warning: input.issues.filter((i) => i.severity === "warning"),
      info: input.issues.filter((i) => i.severity === "info"),
    };

    // Build actionable issues (top 20, critical first)
    const sorted = [...prioritized.critical, ...prioritized.warning, ...prioritized.info];
    const actionableIssues: ActionableIssue[] = sorted.slice(0, 20).map((issue) => ({
      id: issue.id,
      category: issue.category,
      severity: issue.severity,
      message: issue.message,
      componentName: extractComponentName(issue.nodePath),
      tokenName: extractTokenName(issue.message),
      suggestedAction: issue.suggestion ?? inferAction(issue),
    }));

    const context: DesignContextDocument = {
      source: input.source,
      generatedAt: new Date().toISOString(),
      overallScore: input.score,
      categoryScores: input.categoryScores ?? {},
      a11y: input.a11yScore != null
        ? { score: input.a11yScore, violations: input.a11yViolations ?? 0 }
        : null,
      componentCount: componentNames.length,
      tokenCount: tokenNames.length,
      issueCount: input.issues.length,
      criticalCount: prioritized.critical.length,
      actionableIssues,
    };

    ctx.logger.info(
      `[design-context] ${input.source}: score=${input.score}, issues=${input.issues.length} (${prioritized.critical.length} critical)`,
    );

    return {
      output: { context, componentNames, tokenNames, prioritized },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extract component name from Figma path: "Page > Section > Button/Primary" → "Button" */
function extractComponentName(path: string): string | null {
  const segments = path.split(/\s*>\s*/);
  const last = segments[segments.length - 1]?.trim();
  if (!last) return null;
  // Remove variant suffix
  const name = last.split("/")[0].trim();
  // Skip generic names
  if (/^(Frame|Group|Rectangle|Ellipse|Text|Line|Vector)\s*\d*$/i.test(name)) return null;
  return name;
}

/** Extract token name from issue message: "...token 'color-brand-primary'..." → "color-brand-primary" */
function extractTokenName(message: string): string | null {
  const match = message.match(/(?:token|variable)\s+['"]([^'"]+)['"]/i);
  return match?.[1] ?? null;
}

/** Infer action from issue when no suggestion provided */
function inferAction(issue: DesignIssue): string {
  switch (issue.category) {
    case "naming": return "Rename to a descriptive, semantic name";
    case "structure": return "Review component structure and nesting";
    case "tokens": return "Bind to design token variable";
    case "meta": return "Add or update metadata";
    case "completeness": return "Add missing states or variants";
    case "variants": return "Define responsive or state variants";
    default: return "Review and fix";
  }
}
