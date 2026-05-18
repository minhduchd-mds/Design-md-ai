/**
 * ux-checklist/agents/IssueWriterAgent.ts — Issue Writer Agent
 *
 * Generates structured GitHub issues from failed audit criteria.
 * Produces well-formatted issues with title, description, acceptance
 * criteria, labels, priority, and evidence.
 *
 * Role: generator
 */

import type { AuditResult, AuditCriterion, AuditSeverity, AuditCategory } from "../index";
import { BaseAgent } from "./types";
import type { AgentRole, AgentContext, GitHubIssuePayload } from "./types";

/**
 * IssueWriterAgent — Generates structured GitHub issues.
 *
 * Transforms failed audit criteria into well-formatted GitHub issues
 * with title, description, acceptance criteria, labels, and evidence.
 *
 * @example
 * ```ts
 * const agent = new IssueWriterAgent();
 * const result = await agent.execute(failedResults, { projectName: "app", criteria });
 * const issues = result.output as GitHubIssuePayload[];
 * ```
 */
export class IssueWriterAgent extends BaseAgent {
  readonly id = "issue-writer-agent";
  readonly role: AgentRole = "generator";
  readonly capabilities = [
    "github-issue-generation",
    "acceptance-criteria-writing",
    "evidence-attachment",
    "label-inference",
    "priority-mapping",
  ];
  readonly description =
    "Generates structured GitHub issues from failed audit criteria with titles, descriptions, acceptance criteria, and evidence.";

  /** Severity to priority mapping */
  private static readonly PRIORITY_MAP: Record<AuditSeverity, GitHubIssuePayload["priority"]> = {
    critical: "critical",
    major: "high",
    minor: "medium",
    info: "low",
  };

  /** Category to label mapping */
  private static readonly LABEL_MAP: Partial<Record<AuditCategory, string[]>> = {
    contrast: ["accessibility", "a11y", "color"],
    "touch-target": ["accessibility", "a11y", "mobile"],
    aria: ["accessibility", "a11y"],
    accessibility: ["accessibility", "a11y"],
    "screen-reader": ["accessibility", "a11y"],
    color: ["design-system", "tokens"],
    typography: ["design-system", "tokens"],
    spacing: ["design-system", "tokens"],
    elevation: ["design-system", "tokens"],
    button: ["component", "ui"],
    input: ["component", "ui"],
    layout: ["layout", "ui"],
    responsive: ["responsive", "ui"],
    animation: ["motion", "ui"],
    navigation: ["ux", "navigation"],
    feedback: ["ux", "interaction"],
    loading: ["ux", "performance"],
    "error-state": ["ux", "error-handling"],
  };

  protected async run(
    input: unknown,
    context: AgentContext,
  ): Promise<{ output: unknown; confidence: number; tokensUsed: number; evidenceRefs: string[] }> {
    const results = Array.isArray(input) ? (input as AuditResult[]) : [];
    const failedResults = results.filter(
      (r) => r.status === "fail" || r.status === "warn",
    );

    const criteriaMap = new Map(context.criteria.map((c) => [c.id, c]));
    const issues: GitHubIssuePayload[] = [];
    const evidenceRefs: string[] = [];

    for (const result of failedResults) {
      const criterion = criteriaMap.get(result.criterionId);
      if (!criterion) continue;

      const issue = this.generateIssue(result, criterion, context.projectName);
      issues.push(issue);
      if (result.evidenceId) {
        evidenceRefs.push(result.evidenceId);
      }
    }

    return {
      output: issues,
      confidence: issues.length > 0 ? 0.8 : 0,
      tokensUsed: failedResults.length * 40, // Issue writing is token-heavy
      evidenceRefs,
    };
  }

  /** Generate a complete GitHub issue payload for a failed criterion */
  private generateIssue(
    result: AuditResult,
    criterion: AuditCriterion,
    projectName: string,
  ): GitHubIssuePayload {
    const priority = IssueWriterAgent.PRIORITY_MAP[criterion.severity];
    const labels = this.inferLabels(criterion, priority);
    const title = this.generateTitle(criterion, result);
    const body = this.generateBody(result, criterion, projectName);
    const acceptanceCriteria = this.generateAcceptanceCriteria(criterion, result);
    const evidence = this.collectEvidence(result);

    return {
      title,
      body,
      labels,
      priority,
      acceptanceCriteria,
      evidence,
    };
  }

  /** Generate a concise, actionable issue title */
  private generateTitle(criterion: AuditCriterion, result: AuditResult): string {
    const prefix = result.status === "fail" ? "[FAIL]" : "[WARN]";
    const wcagSuffix = criterion.wcagRef ? ` (WCAG ${criterion.wcagRef})` : "";
    return `${prefix} ${criterion.title}${wcagSuffix}`;
  }

  /** Generate the full issue body in markdown */
  private generateBody(
    result: AuditResult,
    criterion: AuditCriterion,
    projectName: string,
  ): string {
    const sections: string[] = [];

    // Header
    sections.push(`## ${criterion.title}`);
    sections.push("");

    // Context
    sections.push("### Context");
    sections.push(`- **Project:** ${projectName}`);
    sections.push(`- **Category:** ${criterion.category}`);
    sections.push(`- **Source:** ${criterion.source}`);
    sections.push(`- **Severity:** ${criterion.severity}`);
    sections.push(`- **Score:** ${result.score}/10`);
    sections.push(`- **Confidence:** ${(result.confidence * 100).toFixed(0)}%`);
    if (criterion.wcagRef) {
      sections.push(`- **WCAG:** ${criterion.wcagRef}`);
    }
    sections.push("");

    // Description
    sections.push("### Description");
    sections.push(criterion.description);
    sections.push("");

    // Findings
    sections.push("### Findings");
    sections.push(result.findings);
    sections.push("");

    // Recommendation
    sections.push("### Recommendation");
    sections.push(result.recommendation);
    sections.push("");

    // Metadata
    sections.push("### Metadata");
    sections.push(`- **Agent:** ${result.agentId}`);
    sections.push(`- **Timestamp:** ${new Date(result.timestamp).toISOString()}`);
    sections.push(`- **Automated:** ${result.metadata.automated ? "Yes" : "No"}`);

    return sections.join("\n");
  }

  /** Generate testable acceptance criteria */
  private generateAcceptanceCriteria(
    criterion: AuditCriterion,
    result: AuditResult,
  ): string[] {
    const criteria: string[] = [];

    // Primary criterion must pass
    criteria.push(`Re-run audit for "${criterion.id}" scores >= 7/10`);

    // Category-specific acceptance criteria
    switch (criterion.category) {
      case "contrast":
        criteria.push("All text elements meet 4.5:1 contrast ratio (AA)");
        criteria.push("Large text (18px+) meets 3:1 contrast ratio");
        break;
      case "touch-target":
        criteria.push("All interactive elements are at least 24x24 CSS pixels");
        criteria.push("Spacing between targets prevents accidental activation");
        break;
      case "aria":
        criteria.push("All interactive elements have accessible names");
        criteria.push("Screen reader can identify all controls");
        break;
      case "accessibility":
        criteria.push("Focus ring visible on all focusable elements");
        criteria.push("Tab order follows logical reading sequence");
        break;
      case "spacing":
        criteria.push("All spacing values align to 4px grid");
        criteria.push("No arbitrary spacing values in component styles");
        break;
      case "typography":
        criteria.push("All text uses type scale tokens");
        criteria.push("No hardcoded font sizes or weights");
        break;
      default:
        criteria.push(`"${criterion.title}" verified manually`);
        criteria.push("No regression in related audit criteria");
    }

    // Confidence threshold
    if (result.confidence < 0.7) {
      criteria.push("Manual QA verification completed");
    }

    return criteria;
  }

  /** Infer labels from criterion metadata */
  private inferLabels(
    criterion: AuditCriterion,
    priority: GitHubIssuePayload["priority"],
  ): string[] {
    const labels = new Set<string>();

    // Category-based labels
    const categoryLabels = IssueWriterAgent.LABEL_MAP[criterion.category];
    if (categoryLabels) {
      for (const label of categoryLabels) labels.add(label);
    }

    // Severity-based label
    if (priority === "critical") labels.add("P0");
    else if (priority === "high") labels.add("P1");
    else if (priority === "medium") labels.add("P2");
    else labels.add("P3");

    // Source-based label
    labels.add(`source:${criterion.source}`);

    // Automation label
    if (criterion.automatable) labels.add("auto-fixable");

    return Array.from(labels);
  }

  /** Collect evidence references from the audit result */
  private collectEvidence(
    result: AuditResult,
  ): Array<{ type: "screenshot" | "node" | "selector"; ref: string }> {
    const evidence: Array<{ type: "screenshot" | "node" | "selector"; ref: string }> = [];

    if (result.evidenceId) {
      evidence.push({ type: "node", ref: result.evidenceId });
    }

    // Extract selector references from metadata if available
    const metadata = result.metadata;
    if (metadata.selector && typeof metadata.selector === "string") {
      evidence.push({ type: "selector", ref: metadata.selector });
    }
    if (metadata.screenshotRef && typeof metadata.screenshotRef === "string") {
      evidence.push({ type: "screenshot", ref: metadata.screenshotRef });
    }

    return evidence;
  }
}
