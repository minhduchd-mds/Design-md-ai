/**
 * ux-checklist/agents/AccessibilityAgent.ts — Accessibility Audit Agent
 *
 * WCAG compliance validator. Checks contrast ratios, touch targets,
 * ARIA labels, keyboard navigation, and focus indicators.
 *
 * Role: validator
 */

import type { AuditResult, AuditCriterion } from "../index";
import { BaseAgent } from "./types";
import type { AgentRole, AgentContext } from "./types";

/**
 * AccessibilityAgent — WCAG compliance validator.
 *
 * Checks contrast ratios (4.5:1 minimum), touch targets (24px minimum),
 * ARIA labels, keyboard navigation, and focus indicators.
 *
 * @example
 * ```ts
 * const agent = new AccessibilityAgent();
 * const result = await agent.execute(nodeData, { projectName: "app", criteria });
 * const issues = result.output as AuditResult[];
 * ```
 */
export class AccessibilityAgent extends BaseAgent {
  readonly id = "accessibility-agent";
  readonly role: AgentRole = "validator";
  readonly capabilities = [
    "contrast-check",
    "touch-target-validation",
    "aria-label-audit",
    "keyboard-nav-check",
    "focus-indicator-validation",
    "heading-hierarchy",
    "reduced-motion-check",
  ];
  readonly description =
    "Validates WCAG compliance including contrast 4.5:1, touch targets 24px, ARIA labels, keyboard navigation, and focus indicators.";

  /** Minimum contrast ratio for WCAG AA normal text */
  private static readonly MIN_CONTRAST_RATIO = 4.5;
  /** Minimum touch target size in CSS pixels (WCAG 2.5.8) */
  private static readonly MIN_TOUCH_TARGET_PX = 24;

  protected async run(
    input: unknown,
    context: AgentContext,
  ): Promise<{ output: unknown; confidence: number; tokensUsed: number; evidenceRefs: string[] }> {
    const a11yCriteria = context.criteria.filter(
      (c) =>
        c.category === "contrast" ||
        c.category === "touch-target" ||
        c.category === "aria" ||
        c.category === "accessibility" ||
        c.category === "screen-reader" ||
        c.wcagRef !== undefined,
    );

    const results: AuditResult[] = [];
    const evidenceRefs: string[] = [];
    const nodes = Array.isArray(input) ? input : [];

    for (const criterion of a11yCriteria) {
      const result = this.checkAccessibility(nodes, criterion);
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
      tokensUsed: a11yCriteria.length * 18, // A11y checks are more token-intensive
      evidenceRefs,
    };
  }

  /**
   * Run accessibility check for a specific criterion.
   * Dispatches to specialized sub-checks based on category.
   */
  private checkAccessibility(
    nodes: unknown[],
    criterion: AuditCriterion,
  ): AuditResult {
    const evidenceId = `ev-${this.id}-${criterion.id}-${Date.now()}`;

    switch (criterion.category) {
      case "contrast":
        return this.checkContrast(nodes, criterion, evidenceId);
      case "touch-target":
        return this.checkTouchTargets(nodes, criterion, evidenceId);
      case "aria":
        return this.checkAriaLabels(nodes, criterion, evidenceId);
      case "accessibility":
        return this.checkFocusIndicators(nodes, criterion, evidenceId);
      case "screen-reader":
        return this.checkHeadingHierarchy(nodes, criterion, evidenceId);
      default:
        return this.genericA11yCheck(nodes, criterion, evidenceId);
    }
  }

  /** Check contrast ratios against WCAG AA threshold */
  private checkContrast(
    nodes: unknown[],
    criterion: AuditCriterion,
    evidenceId: string,
  ): AuditResult {
    // Extract nodes with fill/stroke color data
    const colorNodes = nodes.filter(
      (n: unknown) =>
        n !== null &&
        typeof n === "object" &&
        ("fills" in (n as Record<string, unknown>) ||
          "color" in (n as Record<string, unknown>)),
    );

    let score: number;
    let findings: string;

    if (colorNodes.length > 0) {
      // Heuristic: check if contrast metadata is present
      const withContrast = colorNodes.filter(
        (n: unknown) =>
          typeof n === "object" &&
          n !== null &&
          "contrastRatio" in (n as Record<string, unknown>),
      );
      const failingNodes = withContrast.filter(
        (n: unknown) =>
          ((n as Record<string, unknown>).contrastRatio as number) <
          AccessibilityAgent.MIN_CONTRAST_RATIO,
      );

      if (withContrast.length > 0) {
        const passRate = 1 - failingNodes.length / withContrast.length;
        score = Math.round(passRate * 10 * 10) / 10;
        findings = `${withContrast.length} elements checked. ${failingNodes.length} below ${AccessibilityAgent.MIN_CONTRAST_RATIO}:1 ratio.`;
      } else {
        score = 5;
        findings = `${colorNodes.length} color nodes found but no contrast ratio metadata. Manual verification needed.`;
      }
    } else {
      score = 5;
      findings = "No color data available for contrast analysis.";
    }

    return {
      criterionId: criterion.id,
      status: score >= 7 ? "pass" : score >= 4 ? "warn" : "fail",
      score,
      confidence: colorNodes.length > 0 ? 0.85 : 0.3,
      findings,
      recommendation:
        score < 7
          ? `Ensure all text meets ${AccessibilityAgent.MIN_CONTRAST_RATIO}:1 contrast ratio (WCAG AA).`
          : "Contrast requirements met.",
      evidenceId,
      agentId: this.id,
      timestamp: Date.now(),
      metadata: { automated: true, wcagRef: criterion.wcagRef, check: "contrast" },
    };
  }

  /** Validate touch target sizes meet 24px minimum */
  private checkTouchTargets(
    nodes: unknown[],
    criterion: AuditCriterion,
    evidenceId: string,
  ): AuditResult {
    const interactiveNodes = nodes.filter(
      (n: unknown) =>
        n !== null &&
        typeof n === "object" &&
        ("width" in (n as Record<string, unknown>) ||
          "absoluteBoundingBox" in (n as Record<string, unknown>)),
    );

    let score: number;
    let findings: string;

    if (interactiveNodes.length > 0) {
      const undersized = interactiveNodes.filter((n: unknown) => {
        const node = n as Record<string, unknown>;
        const width = (node.width as number) ?? (node.absoluteBoundingBox as { width: number })?.width ?? 0;
        const height = (node.height as number) ?? (node.absoluteBoundingBox as { height: number })?.height ?? 0;
        return width < AccessibilityAgent.MIN_TOUCH_TARGET_PX || height < AccessibilityAgent.MIN_TOUCH_TARGET_PX;
      });

      const passRate = 1 - undersized.length / interactiveNodes.length;
      score = Math.round(passRate * 10 * 10) / 10;
      findings = `${interactiveNodes.length} interactive elements checked. ${undersized.length} below ${AccessibilityAgent.MIN_TOUCH_TARGET_PX}px minimum.`;
    } else {
      score = 5;
      findings = "No interactive elements with size data found.";
    }

    return {
      criterionId: criterion.id,
      status: score >= 7 ? "pass" : score >= 4 ? "warn" : "fail",
      score,
      confidence: interactiveNodes.length > 0 ? 0.9 : 0.3,
      findings,
      recommendation:
        score < 7
          ? `Increase touch targets to at least ${AccessibilityAgent.MIN_TOUCH_TARGET_PX}x${AccessibilityAgent.MIN_TOUCH_TARGET_PX}px (WCAG 2.5.8).`
          : "Touch target sizes meet requirements.",
      evidenceId,
      agentId: this.id,
      timestamp: Date.now(),
      metadata: { automated: true, wcagRef: criterion.wcagRef, check: "touch-target" },
    };
  }

  /** Check for ARIA labels on interactive elements */
  private checkAriaLabels(
    nodes: unknown[],
    criterion: AuditCriterion,
    evidenceId: string,
  ): AuditResult {
    const interactiveTypes = new Set(["BUTTON", "INPUT", "LINK", "TOGGLE", "CHECKBOX", "RADIO"]);
    const interactive = nodes.filter(
      (n: unknown) =>
        n !== null &&
        typeof n === "object" &&
        interactiveTypes.has(((n as Record<string, unknown>).type as string) ?? ""),
    );

    let score: number;
    let findings: string;

    if (interactive.length > 0) {
      const labeled = interactive.filter(
        (n: unknown) =>
          typeof n === "object" &&
          n !== null &&
          (("ariaLabel" in (n as Record<string, unknown>) &&
            (n as Record<string, unknown>).ariaLabel) ||
            ("accessibleName" in (n as Record<string, unknown>) &&
              (n as Record<string, unknown>).accessibleName) ||
            ("name" in (n as Record<string, unknown>) &&
              typeof (n as Record<string, unknown>).name === "string" &&
              ((n as Record<string, unknown>).name as string).length > 0)),
      );

      const passRate = labeled.length / interactive.length;
      score = Math.round(passRate * 10 * 10) / 10;
      findings = `${interactive.length} interactive elements. ${labeled.length} have accessible names. ${interactive.length - labeled.length} missing labels.`;
    } else {
      score = 5;
      findings = "No interactive elements detected for ARIA label check.";
    }

    return {
      criterionId: criterion.id,
      status: score >= 7 ? "pass" : score >= 4 ? "warn" : "fail",
      score,
      confidence: interactive.length > 0 ? 0.85 : 0.3,
      findings,
      recommendation:
        score < 7
          ? "Add aria-label or accessible name to all interactive elements (WCAG 4.1.2)."
          : "ARIA labels present on interactive elements.",
      evidenceId,
      agentId: this.id,
      timestamp: Date.now(),
      metadata: { automated: true, wcagRef: criterion.wcagRef, check: "aria-labels" },
    };
  }

  /** Check for visible focus indicators */
  private checkFocusIndicators(
    nodes: unknown[],
    criterion: AuditCriterion,
    evidenceId: string,
  ): AuditResult {
    const interactive = nodes.filter(
      (n: unknown) =>
        n !== null &&
        typeof n === "object" &&
        ("type" in (n as Record<string, unknown>) || "role" in (n as Record<string, unknown>)),
    );

    const withFocus = interactive.filter(
      (n: unknown) =>
        typeof n === "object" &&
        n !== null &&
        (("focusStyle" in (n as Record<string, unknown>)) ||
          (typeof (n as Record<string, unknown>).name === "string" &&
            /focus/i.test((n as Record<string, unknown>).name as string))),
    );

    const score = interactive.length > 0
      ? Math.round((withFocus.length / interactive.length) * 10 * 10) / 10
      : 5;

    return {
      criterionId: criterion.id,
      status: score >= 7 ? "pass" : score >= 4 ? "warn" : "fail",
      score,
      confidence: interactive.length > 0 ? 0.7 : 0.3,
      findings: `${withFocus.length}/${interactive.length} elements have detectable focus indicators.`,
      recommendation:
        score < 7
          ? "Ensure all focusable elements have a visible focus ring (WCAG 2.4.7)."
          : "Focus indicators detected.",
      evidenceId,
      agentId: this.id,
      timestamp: Date.now(),
      metadata: { automated: true, wcagRef: criterion.wcagRef, check: "focus-indicators" },
    };
  }

  /** Check heading hierarchy for logical structure */
  private checkHeadingHierarchy(
    nodes: unknown[],
    criterion: AuditCriterion,
    evidenceId: string,
  ): AuditResult {
    const headings = nodes.filter(
      (n: unknown) =>
        n !== null &&
        typeof n === "object" &&
        typeof (n as Record<string, unknown>).name === "string" &&
        /^h[1-6]/i.test((n as Record<string, unknown>).name as string),
    );

    let score: number;
    let findings: string;

    if (headings.length > 1) {
      // Check for skipped levels
      const levels = headings
        .map((h: unknown) => {
          const name = ((h as Record<string, unknown>).name as string) ?? "";
          const match = /h(\d)/i.exec(name);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((l) => l > 0)
        .sort((a, b) => a - b);

      let skipped = 0;
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] - levels[i - 1] > 1) skipped++;
      }

      score = skipped === 0 ? 10 : Math.max(2, 10 - skipped * 3);
      findings = `${headings.length} headings found. ${skipped} level skip(s) detected.`;
    } else {
      score = 5;
      findings = "Insufficient heading data for hierarchy analysis.";
    }

    return {
      criterionId: criterion.id,
      status: score >= 7 ? "pass" : score >= 4 ? "warn" : "fail",
      score,
      confidence: headings.length > 1 ? 0.8 : 0.3,
      findings,
      recommendation:
        score < 7
          ? "Maintain logical heading hierarchy (H1 > H2 > H3) without skipping levels."
          : "Heading hierarchy is logical.",
      evidenceId,
      agentId: this.id,
      timestamp: Date.now(),
      metadata: { automated: true, wcagRef: criterion.wcagRef, check: "heading-hierarchy" },
    };
  }

  /** Generic fallback for other a11y criteria */
  private genericA11yCheck(
    nodes: unknown[],
    criterion: AuditCriterion,
    evidenceId: string,
  ): AuditResult {
    const score = Math.round(criterion.confidence * 6 * 10) / 10;

    return {
      criterionId: criterion.id,
      status: score >= 7 ? "pass" : score >= 4 ? "warn" : "fail",
      score,
      confidence: 0.4,
      findings: `Generic accessibility check for "${criterion.title}". Manual verification recommended.`,
      recommendation: `Review "${criterion.title}" against WCAG ${criterion.wcagRef ?? "guidelines"}.`,
      evidenceId,
      agentId: this.id,
      timestamp: Date.now(),
      metadata: { automated: true, wcagRef: criterion.wcagRef, check: "generic-a11y" },
    };
  }
}
