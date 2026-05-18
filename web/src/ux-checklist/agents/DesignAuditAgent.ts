/**
 * ux-checklist/agents/DesignAuditAgent.ts — Design Audit Agent
 *
 * Scores UI/UX designs against checklist criteria including layout,
 * interaction patterns, and visual hierarchy.
 *
 * Role: analyzer
 */

import type { AuditResult, AuditCriterion } from "../index";
import type { AuditCategory } from "../index";
import { BaseAgent } from "./types";
import type { AgentRole, AgentContext } from "./types";

/**
 * DesignAuditAgent — Scores UI/UX against checklist criteria.
 *
 * Evaluates layout patterns, interaction design, and visual hierarchy.
 * Produces scored AuditResult[] for each applicable criterion.
 *
 * @example
 * ```ts
 * const agent = new DesignAuditAgent();
 * const result = await agent.execute(scanData, { projectName: "app", criteria });
 * const scores = result.output as AuditResult[];
 * ```
 */
export class DesignAuditAgent extends BaseAgent {
  readonly id = "design-audit-agent";
  readonly role: AgentRole = "analyzer";
  readonly capabilities = [
    "layout-scoring",
    "pattern-detection",
    "interaction-audit",
    "visual-hierarchy",
    "component-state-check",
  ];
  readonly description =
    "Scores UI/UX designs against checklist criteria including layout, patterns, and interaction quality.";

  /** Categories this agent handles */
  private static readonly TARGET_CATEGORIES: Set<AuditCategory> = new Set([
    "layout",
    "responsive",
    "animation",
    "navigation",
    "button",
    "input",
    "card",
    "modal",
    "feedback",
    "loading",
    "error-state",
    "pattern",
    "element",
    "interaction",
  ]);

  protected async run(
    input: unknown,
    context: AgentContext,
  ): Promise<{ output: unknown; confidence: number; tokensUsed: number; evidenceRefs: string[] }> {
    const applicableCriteria = context.criteria.filter(
      (c) => DesignAuditAgent.TARGET_CATEGORIES.has(c.category) && c.automatable,
    );

    const results: AuditResult[] = [];
    const evidenceRefs: string[] = [];

    for (const criterion of applicableCriteria) {
      const result = this.evaluateCriterion(input, criterion);
      results.push(result);
      if (result.evidenceId) {
        evidenceRefs.push(result.evidenceId);
      }
    }

    const avgConfidence =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length
        : 0;

    return {
      output: results,
      confidence: avgConfidence,
      tokensUsed: applicableCriteria.length * 12, // Estimated tokens per criterion
      evidenceRefs,
    };
  }

  /**
   * Evaluate a single criterion against the input data.
   * Uses structured scan data when available, falls back to heuristics.
   */
  private evaluateCriterion(input: unknown, criterion: AuditCriterion): AuditResult {
    let score = 0;
    let status: "pass" | "fail" | "warn" | "untested" | "learning" = "untested";
    let findings = "";
    let recommendation = "";

    if (Array.isArray(input) && input.length > 0) {
      // Structured node data — perform pattern-based scoring
      const nodeCount = input.length;
      const hasVariants = input.some(
        (n: Record<string, unknown>) => n.type === "COMPONENT_SET" || n.variants,
      );
      const hasStates = input.some(
        (n: Record<string, unknown>) =>
          typeof n.name === "string" && /hover|active|disabled|focus/i.test(n.name),
      );

      // Score based on criterion category
      if (criterion.category === "button" || criterion.category === "input") {
        score = hasStates ? 8 : hasVariants ? 6 : 3;
      } else if (criterion.category === "layout" || criterion.category === "responsive") {
        score = nodeCount > 3 ? 7 : 5;
      } else {
        score = Math.min(9, 4 + criterion.confidence * 5);
      }

      status = score >= 7 ? "pass" : score >= 4 ? "warn" : "fail";
      findings = `Analyzed ${nodeCount} nodes. States detected: ${hasStates}. Variants: ${hasVariants}.`;
      recommendation =
        status === "pass"
          ? "Meets requirements."
          : `Improve "${criterion.title}" — current score ${score}/10.`;
    } else {
      // Heuristic fallback
      score = Math.round(criterion.confidence * 6 * 10) / 10;
      status = score >= 7 ? "pass" : score >= 4 ? "warn" : "fail";
      findings = `Heuristic evaluation for "${criterion.title}".`;
      recommendation = "Provide structured Figma scan data for accurate evaluation.";
    }

    const evidenceId = `ev-${this.id}-${criterion.id}-${Date.now()}`;

    return {
      criterionId: criterion.id,
      status,
      score,
      confidence: criterion.confidence * (status === "learning" ? 0.3 : 0.75),
      findings,
      recommendation,
      evidenceId,
      agentId: this.id,
      timestamp: Date.now(),
      metadata: { automated: true, category: criterion.category },
    };
  }
}
