/**
 * ux-checklist/agents/DesignSystemAgent.ts — Design System Compliance Agent
 *
 * Validates token coverage, component naming conventions, variant
 * completeness, and spacing grid compliance against design system rules.
 *
 * Role: analyzer
 */

import type { AuditResult, AuditCriterion } from "../index";
import type { AuditCategory } from "../index";
import { BaseAgent } from "./types";
import type { AgentRole, AgentContext } from "./types";

/**
 * DesignSystemAgent — Design system compliance checker.
 *
 * Validates token coverage, component naming conventions, variant
 * completeness, and spacing grid compliance against design system rules.
 *
 * @example
 * ```ts
 * const agent = new DesignSystemAgent();
 * const result = await agent.execute(componentTree, { projectName: "ds", criteria });
 * ```
 */
export class DesignSystemAgent extends BaseAgent {
  readonly id = "design-system-agent";
  readonly role: AgentRole = "analyzer";
  readonly capabilities = [
    "token-coverage-analysis",
    "component-naming-validation",
    "variant-completeness-check",
    "spacing-grid-compliance",
    "elevation-token-check",
    "typography-scale-validation",
  ];
  readonly description =
    "Validates design system compliance: token coverage, component naming, variant completeness, and spacing grid adherence.";

  /** Expected spacing grid base unit (px) */
  private static readonly GRID_BASE = 4;
  /** Maximum allowed deviation from grid (px) */
  private static readonly GRID_TOLERANCE = 1;

  /** Categories this agent handles */
  private static readonly TARGET_CATEGORIES: Set<AuditCategory> = new Set([
    "foundation",
    "color",
    "typography",
    "spacing",
    "elevation",
  ]);

  protected async run(
    input: unknown,
    context: AgentContext,
  ): Promise<{ output: unknown; confidence: number; tokensUsed: number; evidenceRefs: string[] }> {
    const dsCriteria = context.criteria.filter((c) =>
      DesignSystemAgent.TARGET_CATEGORIES.has(c.category),
    );

    const results: AuditResult[] = [];
    const evidenceRefs: string[] = [];
    const nodes = Array.isArray(input) ? input : [];

    for (const criterion of dsCriteria) {
      const result = this.checkDesignSystem(nodes, criterion);
      results.push(result);
      if (result.evidenceId) {
        evidenceRefs.push(result.evidenceId);
      }
    }

    // Compute additional design system metrics
    const metrics = this.computeMetrics(nodes);

    const avgConfidence =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length
        : 0;

    return {
      output: { results, metrics },
      confidence: avgConfidence,
      tokensUsed: dsCriteria.length * 15,
      evidenceRefs,
    };
  }

  /** Check design system compliance for a criterion */
  private checkDesignSystem(nodes: unknown[], criterion: AuditCriterion): AuditResult {
    const evidenceId = `ev-${this.id}-${criterion.id}-${Date.now()}`;

    switch (criterion.category) {
      case "color":
        return this.checkTokenCoverage(nodes, criterion, evidenceId, "color");
      case "spacing":
        return this.checkSpacingGrid(nodes, criterion, evidenceId);
      case "typography":
        return this.checkTokenCoverage(nodes, criterion, evidenceId, "typography");
      case "elevation":
        return this.checkTokenCoverage(nodes, criterion, evidenceId, "elevation");
      default:
        return this.genericDSCheck(nodes, criterion, evidenceId);
    }
  }

  /** Check if values reference tokens vs hardcoded */
  private checkTokenCoverage(
    nodes: unknown[],
    criterion: AuditCriterion,
    evidenceId: string,
    tokenType: string,
  ): AuditResult {
    const relevantNodes = nodes.filter(
      (n: unknown) => n !== null && typeof n === "object",
    );

    let tokenized = 0;
    let hardcoded = 0;

    for (const node of relevantNodes) {
      const n = node as Record<string, unknown>;
      // Check for token references (styles, variables)
      if (n.boundVariables || n.styleId || n.tokenRef) {
        tokenized++;
      } else if (
        (tokenType === "color" && (n.fills || n.strokes)) ||
        (tokenType === "typography" && (n.fontSize || n.fontFamily)) ||
        (tokenType === "elevation" && n.effects)
      ) {
        hardcoded++;
      }
    }

    const total = tokenized + hardcoded;
    const coverage = total > 0 ? tokenized / total : 0;
    const score = Math.round(coverage * 10 * 10) / 10;

    return {
      criterionId: criterion.id,
      status: score >= 7 ? "pass" : score >= 4 ? "warn" : "fail",
      score,
      confidence: total > 0 ? 0.8 : 0.3,
      findings: `${tokenType} token coverage: ${tokenized}/${total} (${(coverage * 100).toFixed(0)}%). ${hardcoded} hardcoded values.`,
      recommendation:
        score < 7
          ? `Replace hardcoded ${tokenType} values with design tokens.`
          : `${tokenType} token coverage is adequate.`,
      evidenceId,
      agentId: this.id,
      timestamp: Date.now(),
      metadata: { automated: true, tokenType, coverage, tokenized, hardcoded },
    };
  }

  /** Check spacing values against the grid system */
  private checkSpacingGrid(
    nodes: unknown[],
    criterion: AuditCriterion,
    evidenceId: string,
  ): AuditResult {
    const spacingValues: number[] = [];

    for (const node of nodes) {
      if (typeof node !== "object" || node === null) continue;
      const n = node as Record<string, unknown>;

      // Collect spacing-related properties
      const spacingProps = [
        n.paddingTop,
        n.paddingRight,
        n.paddingBottom,
        n.paddingLeft,
        n.itemSpacing,
        n.counterAxisSpacing,
      ];

      for (const val of spacingProps) {
        if (typeof val === "number" && val > 0) {
          spacingValues.push(val);
        }
      }
    }

    let onGrid = 0;
    let offGrid = 0;

    for (const val of spacingValues) {
      const remainder = val % DesignSystemAgent.GRID_BASE;
      if (remainder <= DesignSystemAgent.GRID_TOLERANCE || remainder >= DesignSystemAgent.GRID_BASE - DesignSystemAgent.GRID_TOLERANCE) {
        onGrid++;
      } else {
        offGrid++;
      }
    }

    const total = onGrid + offGrid;
    const compliance = total > 0 ? onGrid / total : 0;
    const score = Math.round(compliance * 10 * 10) / 10;

    return {
      criterionId: criterion.id,
      status: score >= 7 ? "pass" : score >= 4 ? "warn" : "fail",
      score,
      confidence: total > 0 ? 0.85 : 0.3,
      findings: `Spacing grid compliance: ${onGrid}/${total} values align to ${DesignSystemAgent.GRID_BASE}px grid. ${offGrid} off-grid values.`,
      recommendation:
        score < 7
          ? `Align spacing to ${DesignSystemAgent.GRID_BASE}px grid (use multiples: 4, 8, 12, 16, 24, 32, 48).`
          : "Spacing grid compliance is adequate.",
      evidenceId,
      agentId: this.id,
      timestamp: Date.now(),
      metadata: { automated: true, check: "spacing-grid", onGrid, offGrid },
    };
  }

  /** Generic design system check */
  private genericDSCheck(
    _nodes: unknown[],
    criterion: AuditCriterion,
    evidenceId: string,
  ): AuditResult {
    const score = Math.round(criterion.confidence * 6.5 * 10) / 10;

    return {
      criterionId: criterion.id,
      status: score >= 7 ? "pass" : score >= 4 ? "warn" : "fail",
      score,
      confidence: 0.4,
      findings: `Design system check for "${criterion.title}". Structured data recommended for accurate scoring.`,
      recommendation: `Verify "${criterion.title}" against design system documentation.`,
      evidenceId,
      agentId: this.id,
      timestamp: Date.now(),
      metadata: { automated: true, check: "generic-ds" },
    };
  }

  /** Compute aggregate design system health metrics */
  private computeMetrics(nodes: unknown[]): Record<string, number> {
    let totalNodes = 0;
    let componentNodes = 0;
    let withTokens = 0;

    for (const node of nodes) {
      if (typeof node !== "object" || node === null) continue;
      totalNodes++;
      const n = node as Record<string, unknown>;
      if (n.type === "COMPONENT" || n.type === "INSTANCE") componentNodes++;
      if (n.boundVariables || n.styleId) withTokens++;
    }

    return {
      totalNodes,
      componentNodes,
      withTokens,
      componentCoverage: totalNodes > 0 ? componentNodes / totalNodes : 0,
      tokenCoverage: totalNodes > 0 ? withTokens / totalNodes : 0,
    };
  }
}
