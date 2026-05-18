/**
 * ux-checklist/agents.ts — Specialized Agentic Auditors v4
 *
 * Five specialized agents that decompose the generic AuditAgent
 * into focused, composable units aligned with Shannon Engine's
 * AgentConfig pattern.
 *
 * Agent roles:
 *   DesignAuditAgent   → analyzer   — Scores UI/UX against checklist criteria
 *   AccessibilityAgent → validator  — WCAG compliance checks
 *   DesignSystemAgent  → analyzer   — Token/component/spacing compliance
 *   FixPlannerAgent    → optimizer  — Creates safe fix plans from failures
 *   IssueWriterAgent   → generator  — Produces structured GitHub issues
 *
 * All agents implement the AgentConfig registration pattern and return
 * typed AgentExecutionResult for pipeline composition.
 */

import type {
  AuditResult,
  AuditCriterion,
  AuditSeverity,
  AuditCategory,
} from "./index";

// ── Agent Role Types ──────────────────────────────────────────

/** Shannon Engine agent role classification */
export type AgentRole =
  | "analyzer"
  | "generator"
  | "validator"
  | "optimizer"
  | "orchestrator";

// ── Shared Types ──────────────────────────────────────────────

/**
 * A single step within a fix plan, describing what to change,
 * which element to target, and the associated risk level.
 */
export interface FixPlanStep {
  /** The action to perform (e.g., "increase contrast ratio") */
  action: string;
  /** The target element or file (e.g., "Button.primary background") */
  target: string;
  /** Risk level of this change */
  risk: "low" | "medium" | "high";
}

/**
 * A structured fix plan generated from a failed audit criterion.
 * Describes what needs to change, how long it will take, and
 * whether automation can handle it.
 */
export interface FixPlan {
  /** The criterion that failed */
  criterionId: string;
  /** Human-readable title for the fix */
  title: string;
  /** Ordered steps to resolve the issue */
  steps: FixPlanStep[];
  /** Estimated time to complete all steps */
  estimatedMinutes: number;
  /** Whether this fix can be applied automatically */
  automated: boolean;
  /** Optional code-level changes required */
  codeChanges?: Array<{ file: string; description: string }>;
}

/**
 * Structured payload for creating a GitHub issue from a failed
 * audit criterion. Includes all metadata needed for triage.
 */
export interface GitHubIssuePayload {
  /** Issue title (concise, actionable) */
  title: string;
  /** Markdown issue body with full context */
  body: string;
  /** Labels to apply (e.g., ["accessibility", "design-system"]) */
  labels: string[];
  /** Priority for triage */
  priority: "critical" | "high" | "medium" | "low";
  /** Testable acceptance criteria */
  acceptanceCriteria: string[];
  /** Evidence references supporting the issue */
  evidence: Array<{ type: "screenshot" | "node" | "selector"; ref: string }>;
}

/**
 * Standardized result envelope returned by all agents.
 * Enables pipeline composition and telemetry tracking.
 */
export interface AgentExecutionResult {
  /** Which agent produced this result */
  agentId: string;
  /** Whether execution completed without errors */
  success: boolean;
  /** The typed output payload (varies by agent) */
  output: unknown;
  /** Agent's self-assessed confidence in the result (0-1) */
  confidence: number;
  /** Token count consumed (for cost tracking) */
  tokensUsed: number;
  /** Wall-clock execution time in milliseconds */
  latencyMs: number;
  /** IDs of evidence records supporting this result */
  evidenceRefs: string[];
}

// ── Agent Configuration ───────────────────────────────────────

/**
 * Shannon Engine AgentConfig registration shape.
 * Each agent registers itself with this metadata for orchestration.
 */
export interface AgentConfig {
  /** Unique agent identifier */
  id: string;
  /** Agent's functional role in the pipeline */
  role: AgentRole;
  /** List of capability strings for routing decisions */
  capabilities: string[];
  /** Human-readable description */
  description: string;
  /** Maximum concurrent executions allowed */
  maxConcurrency: number;
  /** Timeout in milliseconds before the agent is killed */
  timeoutMs: number;
}

/**
 * Context passed to agents during execution.
 * Provides access to shared state and configuration.
 */
export interface AgentContext {
  /** Project name being audited */
  projectName: string;
  /** All criteria available in the registry */
  criteria: AuditCriterion[];
  /** Previous audit results (for cross-referencing) */
  previousResults?: AuditResult[];
  /** Arbitrary metadata for agent-specific needs */
  metadata?: Record<string, unknown>;
}

// ── Base Agent ────────────────────────────────────────────────

/**
 * Abstract base class for all specialized agents.
 * Provides common execution wrapper with timing and error handling.
 */
abstract class BaseAgent {
  abstract readonly id: string;
  abstract readonly role: AgentRole;
  abstract readonly capabilities: string[];
  abstract readonly description: string;

  /** Default timeout: 30 seconds */
  readonly timeoutMs = 30_000;
  /** Default concurrency: 1 */
  readonly maxConcurrency = 1;

  /**
   * Execute the agent's core logic with timing and error wrapping.
   * Subclasses implement `run()` for their specific logic.
   */
  async execute(input: unknown, context: AgentContext): Promise<AgentExecutionResult> {
    const start = performance.now();

    try {
      const result = await this.run(input, context);
      const latencyMs = Math.round(performance.now() - start);

      return {
        agentId: this.id,
        success: true,
        output: result.output,
        confidence: result.confidence,
        tokensUsed: result.tokensUsed,
        latencyMs,
        evidenceRefs: result.evidenceRefs,
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        agentId: this.id,
        success: false,
        output: { error: error instanceof Error ? error.message : "Unknown error" },
        confidence: 0,
        tokensUsed: 0,
        latencyMs,
        evidenceRefs: [],
      };
    }
  }

  /** Subclass-specific execution logic */
  protected abstract run(
    input: unknown,
    context: AgentContext,
  ): Promise<{
    output: unknown;
    confidence: number;
    tokensUsed: number;
    evidenceRefs: string[];
  }>;

  /** Get the AgentConfig for Shannon Engine registration */
  toConfig(): AgentConfig {
    return {
      id: this.id,
      role: this.role,
      capabilities: this.capabilities,
      description: this.description,
      maxConcurrency: this.maxConcurrency,
      timeoutMs: this.timeoutMs,
    };
  }
}

// ── 1. DesignAuditAgent ───────────────────────────────────────

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

// ── 2. AccessibilityAgent ─────────────────────────────────────

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

// ── 3. DesignSystemAgent ──────────────────────────────────────

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

// ── 4. FixPlannerAgent ────────────────────────────────────────

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

// ── 5. IssueWriterAgent ───────────────────────────────────────

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

// ── Agent Registry ────────────────────────────────────────────

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
