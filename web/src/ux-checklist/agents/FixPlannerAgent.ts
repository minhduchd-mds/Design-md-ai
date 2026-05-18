/**
 * ux-checklist/agents/FixPlannerAgent.ts — Fix Planner Agent
 *
 * Creates safe, prioritized fix plans from failed audit results.
 * Generates actionable steps with estimated effort, risk levels,
 * and automation feasibility.
 *
 * Role: optimizer
 */

import type { AuditResult, AuditCriterion, AuditSeverity, AuditCategory } from "../index";
import { BaseAgent } from "./types";
import type { AgentRole, AgentContext, FixPlan, FixPlanStep } from "./types";

/**
 * FixPlannerAgent — Creates safe, prioritized fix plans.
 *
 * Takes failed audit results and generates actionable fix plans
 * with estimated effort, risk levels, and automation feasibility.
 *
 * @example
 * ```ts
 * const agent = new FixPlannerAgent();
 * const result = await agent.execute(failedResults, { projectName: "app", criteria });
 * const plans = result.output as FixPlan[];
 * ```
 */
export class FixPlannerAgent extends BaseAgent {
  readonly id = "fix-planner-agent";
  readonly role: AgentRole = "optimizer";
  readonly capabilities = [
    "fix-plan-generation",
    "effort-estimation",
    "risk-assessment",
    "automation-detection",
    "dependency-analysis",
  ];
  readonly description =
    "Creates safe fix plans from audit results with estimated effort, risk levels, and code change descriptions.";

  /** Risk mappings by severity */
  private static readonly SEVERITY_RISK: Record<AuditSeverity, "low" | "medium" | "high"> = {
    critical: "high",
    major: "medium",
    minor: "low",
    info: "low",
  };

  /** Estimated minutes by category */
  private static readonly EFFORT_MAP: Partial<Record<AuditCategory, number>> = {
    contrast: 15,
    "touch-target": 10,
    aria: 20,
    accessibility: 25,
    "screen-reader": 20,
    color: 15,
    typography: 10,
    spacing: 10,
    elevation: 5,
    button: 20,
    input: 25,
    layout: 30,
    responsive: 45,
    animation: 20,
    navigation: 30,
  };

  protected async run(
    input: unknown,
    context: AgentContext,
  ): Promise<{ output: unknown; confidence: number; tokensUsed: number; evidenceRefs: string[] }> {
    // Input should be AuditResult[] (failed/warned results)
    const results = Array.isArray(input) ? (input as AuditResult[]) : [];
    const failedResults = results.filter(
      (r) => r.status === "fail" || r.status === "warn",
    );

    const criteriaMap = new Map(context.criteria.map((c) => [c.id, c]));
    const plans: FixPlan[] = [];
    const evidenceRefs: string[] = [];

    for (const result of failedResults) {
      const criterion = criteriaMap.get(result.criterionId);
      if (!criterion) continue;

      const plan = this.generateFixPlan(result, criterion);
      plans.push(plan);
      if (result.evidenceId) {
        evidenceRefs.push(result.evidenceId);
      }
    }

    // Sort by priority: critical first, then by effort (quick wins first within same priority)
    plans.sort((a, b) => {
      const riskOrder = { high: 0, medium: 1, low: 2 };
      const aMaxRisk = Math.min(...a.steps.map((s) => riskOrder[s.risk]));
      const bMaxRisk = Math.min(...b.steps.map((s) => riskOrder[s.risk]));
      if (aMaxRisk !== bMaxRisk) return aMaxRisk - bMaxRisk;
      return a.estimatedMinutes - b.estimatedMinutes;
    });

    return {
      output: plans,
      confidence: plans.length > 0 ? 0.75 : 0,
      tokensUsed: failedResults.length * 25,
      evidenceRefs,
    };
  }

  /** Generate a fix plan for a single failed criterion */
  private generateFixPlan(result: AuditResult, criterion: AuditCriterion): FixPlan {
    const baseRisk = FixPlannerAgent.SEVERITY_RISK[criterion.severity];
    const estimatedMinutes =
      FixPlannerAgent.EFFORT_MAP[criterion.category] ?? 15;
    const automated = criterion.automatable && result.score >= 3;

    const steps = this.generateSteps(result, criterion, baseRisk);
    const codeChanges = this.inferCodeChanges(criterion);

    return {
      criterionId: criterion.id,
      title: `Fix: ${criterion.title}`,
      steps,
      estimatedMinutes: automated ? Math.round(estimatedMinutes * 0.3) : estimatedMinutes,
      automated,
      codeChanges: codeChanges.length > 0 ? codeChanges : undefined,
    };
  }

  /** Generate ordered fix steps based on criterion type */
  private generateSteps(
    result: AuditResult,
    criterion: AuditCriterion,
    baseRisk: "low" | "medium" | "high",
  ): FixPlanStep[] {
    const steps: FixPlanStep[] = [];

    // Step 1: Identify affected elements
    steps.push({
      action: `Identify all elements failing "${criterion.title}"`,
      target: criterion.category,
      risk: "low",
    });

    // Step 2: Category-specific fix action
    switch (criterion.category) {
      case "contrast":
        steps.push({
          action: "Adjust foreground/background colors to meet 4.5:1 ratio",
          target: "Color tokens",
          risk: baseRisk,
        });
        break;
      case "touch-target":
        steps.push({
          action: "Increase element dimensions to minimum 24x24px",
          target: "Interactive components",
          risk: "low",
        });
        break;
      case "aria":
        steps.push({
          action: "Add aria-label or aria-labelledby to unlabeled elements",
          target: "Interactive elements",
          risk: "low",
        });
        break;
      case "spacing":
        steps.push({
          action: "Align spacing values to 4px grid multiples",
          target: "Layout tokens",
          risk: "low",
        });
        break;
      case "typography":
        steps.push({
          action: "Replace hardcoded font values with type scale tokens",
          target: "Text styles",
          risk: baseRisk,
        });
        break;
      default:
        steps.push({
          action: `Address "${criterion.title}" as described in findings`,
          target: criterion.category,
          risk: baseRisk,
        });
    }

    // Step 3: Verification
    steps.push({
      action: "Run automated re-check to verify fix",
      target: `Criterion: ${criterion.id}`,
      risk: "low",
    });

    return steps;
  }

  /** Infer likely code changes based on criterion category */
  private inferCodeChanges(
    criterion: AuditCriterion,
  ): Array<{ file: string; description: string }> {
    const changes: Array<{ file: string; description: string }> = [];

    if (criterion.category === "color" || criterion.category === "contrast") {
      changes.push({
        file: "tokens/colors.ts",
        description: "Update color token values for WCAG compliance",
      });
    }

    if (criterion.category === "spacing") {
      changes.push({
        file: "tokens/spacing.ts",
        description: "Align spacing tokens to grid system",
      });
    }

    if (criterion.category === "aria" || criterion.category === "accessibility") {
      changes.push({
        file: "components/*.tsx",
        description: "Add accessibility attributes to interactive elements",
      });
    }

    if (criterion.category === "typography") {
      changes.push({
        file: "tokens/typography.ts",
        description: "Define missing type scale tokens",
      });
    }

    return changes;
  }
}
