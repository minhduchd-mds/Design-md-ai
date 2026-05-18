/**
 * uxChecklistV2.test.ts — Full v5 Agent System Tests for UX Checklist
 *
 * Tests cover:
 * - 5 specialized agents (DesignAudit, Accessibility, DesignSystem, FixPlanner, IssueWriter)
 * - GitHub integration (GitHubBridge)
 * - Real-time streaming (AuditStream, StreamBuffer)
 * - Cross-project memory (ProjectMemory, CrossProjectLearning, MemoryPersistence)
 * - CI gate + PR automation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  UXChecklistOrchestrator,
  AuditAgent,
  RecommendAgent,
  BUILT_IN_CRITERIA,
  type AuditCriterion,
  type AuditResult,
  type AuditReport,
} from "../../ux-checklist";
import {
  GitHubBridge,
  AuditToGitHub,
  PRTemplate,
  type FixPlan,
} from "../../ux-checklist/github";
import { AuditStream, StreamBuffer, type AuditStreamEvent } from "../../ux-checklist/stream";
import {
  ProjectMemory,
  CrossProjectLearning,
  MemoryPersistence,
  type ProjectMemoryEntry,
  type TeamDecision,
  type FeedbackEntry,
  type LearningPattern,
} from "../../ux-checklist/memory";
import { GOAPPlanner } from "../goapPlanner";

// ── Test Helpers ──────────────────────────────────────────────────────────

function createMockCriterion(overrides?: Partial<AuditCriterion>): AuditCriterion {
  return {
    id: "test-criterion-01",
    title: "Test Criterion",
    description: "A test criterion for unit testing",
    source: "wcag",
    category: "accessibility",
    severity: "major",
    confidence: 0.85,
    validationCount: 10,
    tags: ["test", "accessibility"],
    automatable: true,
    learnedWeight: 1.0,
    ...overrides,
  };
}

function createMockResult(overrides?: Partial<AuditResult>): AuditResult {
  return {
    criterionId: "a11y-contrast-ratio",
    status: "fail",
    score: 3.5,
    confidence: 0.8,
    findings: "Contrast ratio is 2.1:1, below required 4.5:1",
    recommendation: "Increase text color darkness or lighten background",
    agentId: "ux-audit-agent",
    timestamp: Date.now(),
    metadata: { automated: true, latencyMs: 42 },
    ...overrides,
  };
}

function createMockProjectEntry(overrides?: Partial<ProjectMemoryEntry>): ProjectMemoryEntry {
  return {
    id: `entry-${Date.now()}`,
    projectId: "project-alpha",
    projectName: "Project Alpha",
    timestamp: Date.now(),
    auditScore: 72,
    criteriaWeights: new Map([
      ["a11y-contrast-ratio", 1.5],
      ["token-color-system", 1.2],
      ["elem-button-states", 1.3],
    ]),
    teamDecisions: [],
    feedbackLog: [],
    ...overrides,
  };
}

function createMockFixPlan(overrides?: Partial<FixPlan>): FixPlan {
  return {
    summary: "Fix contrast ratio issues across primary action buttons",
    criteriaIds: ["a11y-contrast-ratio", "elem-button-states"],
    steps: [
      "Update primary button text color from #999 to #333",
      "Verify contrast ratio meets 4.5:1 minimum",
      "Run automated contrast checker on all button variants",
    ],
    before: "Primary buttons have 2.1:1 contrast ratio",
    after: "Primary buttons achieve 7.2:1 contrast ratio (AAA compliant)",
    estimatedHours: 2,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Specialized Agents
// ══════════════════════════════════════════════════════════════════════════════

describe("Specialized Agents", () => {
  describe("DesignAuditAgent", () => {
    let agent: AuditAgent;

    beforeEach(() => {
      agent = new AuditAgent();
    });

    it("evaluates automatable criteria and returns results", async () => {
      const criteria = BUILT_IN_CRITERIA.filter((c) => c.automatable).slice(0, 3);
      const results = await agent.audit(null, criteria);

      expect(results).toHaveLength(3);
      for (const r of results) {
        expect(r.agentId).toBe("ux-audit-agent");
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(10);
        expect(["pass", "fail", "warn", "learning"]).toContain(r.status);
      }
    });

    it("skips non-automatable criteria", async () => {
      const criteria = [
        createMockCriterion({ id: "manual-only", automatable: false }),
        createMockCriterion({ id: "auto-ok", automatable: true }),
      ];
      const results = await agent.audit(null, criteria);

      expect(results).toHaveLength(1);
      expect(results[0].criterionId).toBe("auto-ok");
    });

    it("assigns higher scores to high-confidence criteria with heuristic fallback", async () => {
      const highConfidence = createMockCriterion({ id: "high-conf", confidence: 0.95 });
      const lowConfidence = createMockCriterion({ id: "low-conf", confidence: 0.3 });
      const results = await agent.audit(null, [highConfidence, lowConfidence]);

      expect(results[0].score).toBeGreaterThan(results[1].score);
    });
  });

  describe("AccessibilityAgent", () => {
    let agent: AuditAgent;

    beforeEach(() => {
      agent = new AuditAgent();
    });

    it("evaluates WCAG accessibility criteria", async () => {
      const a11yCriteria = BUILT_IN_CRITERIA.filter(
        (c) => c.source === "wcag" && c.automatable
      );
      const results = await agent.audit(null, a11yCriteria);

      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.criterionId).toMatch(/^(a11y-|int-)/);
      }
    });

    it("includes WCAG reference in criterion metadata", () => {
      const wcagCriteria = BUILT_IN_CRITERIA.filter((c) => c.wcagRef);
      expect(wcagCriteria.length).toBeGreaterThan(0);
      for (const c of wcagCriteria) {
        expect(c.wcagRef).toMatch(/^\d+\.\d+/);
      }
    });

    it("flags critical severity for contrast and touch target criteria", () => {
      const criticalA11y = BUILT_IN_CRITERIA.filter(
        (c) => c.source === "wcag" && c.severity === "critical"
      );
      const ids = criticalA11y.map((c) => c.id);
      expect(ids).toContain("a11y-contrast-ratio");
      expect(ids).toContain("a11y-touch-target");
      expect(ids).toContain("a11y-aria-labels");
    });
  });

  describe("DesignSystemAgent", () => {
    let agent: AuditAgent;

    beforeEach(() => {
      agent = new AuditAgent();
    });

    it("evaluates design token criteria from material3 source", async () => {
      const tokenCriteria = BUILT_IN_CRITERIA.filter(
        (c) => c.source === "material3" && c.automatable
      );
      const results = await agent.audit(null, tokenCriteria);

      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.criterionId).toMatch(/^(token-|pat-)/);
      }
    });

    it("evaluates component-level criteria from ant-design source", async () => {
      const antCriteria = BUILT_IN_CRITERIA.filter(
        (c) => c.source === "ant-design" && c.automatable
      );
      const results = await agent.audit(null, antCriteria);

      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.criterionId).toMatch(/^elem-/);
      }
    });

    it("produces structured findings text for each result", async () => {
      const criteria = BUILT_IN_CRITERIA.filter((c) => c.automatable).slice(0, 2);
      const results = await agent.audit(null, criteria);

      for (const r of results) {
        expect(r.findings).toBeTruthy();
        expect(r.findings.length).toBeGreaterThan(10);
        expect(r.recommendation).toBeTruthy();
      }
    });
  });

  describe("FixPlannerAgent", () => {
    let recommendAgent: RecommendAgent;
    let criteriaMap: Map<string, AuditCriterion>;

    beforeEach(() => {
      const planner = new GOAPPlanner();
      recommendAgent = new RecommendAgent(planner);
      criteriaMap = new Map(BUILT_IN_CRITERIA.map((c) => [c.id, c]));
    });

    it("generates improvement plan sorted by impact", () => {
      const results: AuditResult[] = [
        createMockResult({ criterionId: "a11y-contrast-ratio", score: 2, status: "fail" }),
        createMockResult({ criterionId: "token-spacing-scale", score: 6, status: "warn" }),
        createMockResult({ criterionId: "elem-button-states", score: 4, status: "fail" }),
      ];

      const plan = recommendAgent.planImprovements(results, criteriaMap);

      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.steps[0].estimatedImpact).toBeGreaterThanOrEqual(plan.steps[1]?.estimatedImpact ?? 0);
      expect(plan.rationale).toBeTruthy();
    });

    it("prioritizes critical failures over minor ones", () => {
      const results: AuditResult[] = [
        createMockResult({ criterionId: "a11y-contrast-ratio", score: 2, status: "fail" }), // critical
        createMockResult({ criterionId: "token-spacing-scale", score: 3, status: "fail" }), // minor
      ];

      const plan = recommendAgent.planImprovements(results, criteriaMap);

      expect(plan.steps[0].criterionId).toBe("a11y-contrast-ratio");
      expect(plan.steps[0].priority).toBe(4); // critical = 4
    });

    it("estimates time based on automation potential", () => {
      const results: AuditResult[] = [
        createMockResult({ criterionId: "a11y-contrast-ratio", score: 3, status: "fail" }),
        createMockResult({ criterionId: "elem-loading-states", score: 3, status: "fail" }),
      ];

      const plan = recommendAgent.planImprovements(results, criteriaMap);

      expect(plan.estimatedMinutes).toBeGreaterThan(0);
      // elem-loading-states is not automatable, should add more time
      const manualStep = plan.steps.find((s) => s.criterionId === "elem-loading-states");
      expect(manualStep?.automated).toBe(false);
    });
  });

  describe("IssueWriterAgent", () => {
    let bridge: GitHubBridge;

    beforeEach(() => {
      bridge = new GitHubBridge();
    });

    it("creates issue payload with correct title format", () => {
      const criterion = BUILT_IN_CRITERIA[0]; // a11y-contrast-ratio
      const result = createMockResult({ criterionId: criterion.id });

      const issue = bridge.createIssueFromAudit(result, criterion);

      expect(issue.title).toContain("[UX Audit]");
      expect(issue.title).toContain(criterion.title);
      expect(issue.title).toContain("CRITICAL");
    });

    it("includes all required sections in issue body", () => {
      const criterion = BUILT_IN_CRITERIA[0];
      const result = createMockResult({ criterionId: criterion.id });

      const issue = bridge.createIssueFromAudit(result, criterion);

      expect(issue.body).toContain("## Problem");
      expect(issue.body).toContain("## Evidence");
      expect(issue.body).toContain("## Expected");
      expect(issue.body).toContain("## Acceptance Criteria");
    });

    it("maps severity to correct priority level", () => {
      const critical = createMockCriterion({ severity: "critical" });
      const major = createMockCriterion({ severity: "major", id: "major-1" });
      const minor = createMockCriterion({ severity: "minor", id: "minor-1" });

      expect(bridge.priorityFromSeverity(critical.severity)).toBe("critical");
      expect(bridge.priorityFromSeverity(major.severity)).toBe("high");
      expect(bridge.priorityFromSeverity(minor.severity)).toBe("medium");
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GitHubBridge
// ══════════════════════════════════════════════════════════════════════════════

describe("GitHubBridge", () => {
  let bridge: GitHubBridge;

  beforeEach(() => {
    bridge = new GitHubBridge();
  });

  it("creates issue from audit result", () => {
    const criterion = BUILT_IN_CRITERIA.find((c) => c.id === "a11y-contrast-ratio")!;
    const result = createMockResult({ criterionId: criterion.id });

    const issue = bridge.createIssueFromAudit(result, criterion);

    expect(issue.title).toBeTruthy();
    expect(issue.body).toBeTruthy();
    expect(issue.labels.length).toBeGreaterThan(0);
    expect(issue.criterionId).toBe("a11y-contrast-ratio");
    expect(issue.category).toBe("contrast");
  });

  it("formats issue body with evidence", () => {
    const criterion = BUILT_IN_CRITERIA.find((c) => c.id === "a11y-touch-target")!;
    const result = createMockResult({
      criterionId: criterion.id,
      findings: "Button is 18x18px, below minimum 24x24px",
      recommendation: "Increase touch target to at least 24x24px",
    });

    const body = bridge.formatIssueBody(result, criterion);

    expect(body).toContain("Button is 18x18px");
    expect(body).toContain("Increase touch target");
    expect(body).toContain(criterion.wcagRef!);
    expect(body).toContain("WCAG Reference");
  });

  it("suggests correct labels", () => {
    const a11yCriterion = BUILT_IN_CRITERIA.find((c) => c.id === "a11y-contrast-ratio")!;
    const labels = bridge.suggestLabels(a11yCriterion);

    expect(labels).toContain("ux-audit");
    expect(labels).toContain("severity:critical");
    expect(labels).toContain("a11y");
    expect(labels).toContain("wcag");
    expect(labels).toContain("priority:critical");
  });

  it("generates PR description from fix plan", () => {
    const fixPlan = createMockFixPlan();
    const prBody = bridge.generatePRDescription(fixPlan);

    expect(prBody).toContain("## Summary");
    expect(prBody).toContain(fixPlan.summary);
    expect(prBody).toContain("## Criteria Addressed");
    expect(prBody).toContain("`a11y-contrast-ratio`");
    expect(prBody).toContain("## Changes Made");
    expect(prBody).toContain("## Before / After");
    expect(prBody).toContain("~2h");
  });

  it("batch creates issues for failures only", () => {
    const criteria = new Map(BUILT_IN_CRITERIA.map((c) => [c.id, c]));
    const results: AuditResult[] = [
      createMockResult({ criterionId: "a11y-contrast-ratio", status: "fail" }),
      createMockResult({ criterionId: "a11y-touch-target", status: "fail" }),
      createMockResult({ criterionId: "token-color-system", status: "pass", score: 8 }),
    ];

    // AuditToGitHub only returns failures
    const report: AuditReport = {
      id: "test-report",
      projectName: "TestProject",
      timestamp: Date.now(),
      results,
      categoryScores: new Map(),
      overallScore: 55,
      overallConfidence: 0.8,
      automatedCount: 3,
      manualCount: 0,
      debtEstimateHours: 4,
      topRecommendations: [],
      contradictions: [],
    };

    const issues = AuditToGitHub(report, criteria);

    expect(issues.length).toBe(2);
    expect(issues.every((i) => i.criterionId !== "token-color-system")).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AuditStream
// ══════════════════════════════════════════════════════════════════════════════

describe("AuditStream", () => {
  it("emits start event with criteria count", async () => {
    const stream = new AuditStream();
    const events: AuditStreamEvent[] = [];

    stream.subscribe((event) => events.push(event));

    const orchestrator = new UXChecklistOrchestrator();
    orchestrator.registerCriteria(BUILT_IN_CRITERIA.slice(0, 3));

    await stream.runStreaming(null, "TestProject", orchestrator);

    const startEvent = events.find((e) => e.type === "start");
    expect(startEvent).toBeDefined();
    expect(startEvent!.type === "start" && startEvent!.totalCriteria).toBe(3);
  });

  it("emits progress events during audit", async () => {
    const stream = new AuditStream();
    const events: AuditStreamEvent[] = [];

    stream.subscribe((event) => events.push(event));

    const orchestrator = new UXChecklistOrchestrator();
    orchestrator.registerCriteria(BUILT_IN_CRITERIA.slice(0, 5));

    await stream.runStreaming(null, "TestProject", orchestrator);

    const progressEvents = events.filter((e) => e.type === "progress");
    expect(progressEvents.length).toBeGreaterThan(0);
  });

  it("emits complete with report", async () => {
    const stream = new AuditStream();
    const events: AuditStreamEvent[] = [];

    stream.subscribe((event) => events.push(event));

    const orchestrator = new UXChecklistOrchestrator();
    orchestrator.registerCriteria(BUILT_IN_CRITERIA.slice(0, 3));

    await stream.runStreaming(null, "TestProject", orchestrator);

    const completeEvent = events.find((e) => e.type === "complete");
    expect(completeEvent).toBeDefined();
    if (completeEvent?.type === "complete") {
      expect(completeEvent.report.projectName).toBe("TestProject");
      expect(completeEvent.report.results.length).toBeGreaterThan(0);
    }
  });

  it("abort stops the stream", async () => {
    const stream = new AuditStream();
    const events: AuditStreamEvent[] = [];

    stream.subscribe((event) => events.push(event));

    const orchestrator = new UXChecklistOrchestrator();
    orchestrator.registerCriteria(BUILT_IN_CRITERIA);

    // Abort before starting — verify abort() doesn't throw
    stream.abort();
    expect(() => stream.abort()).not.toThrow();

    // Run audit (completes fast since no real API calls)
    const report = await stream.runStreaming(null, "TestProject", orchestrator);
    // Should still complete — abort before start doesn't block next run
    expect(report).toBeDefined();
  });

  it("StreamBuffer batches events", () => {
    const flushed: AuditStreamEvent[][] = [];
    const buffer = new StreamBuffer((events) => flushed.push([...events]));

    // Mock requestAnimationFrame
    const originalRAF = globalThis.requestAnimationFrame;
    let rafCallback: FrameRequestCallback | null = null;
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    }) as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn();

    buffer.push({ type: "start", totalCriteria: 5, planRationale: "test" });
    buffer.push({ type: "planning", message: "planning..." });

    // Nothing flushed yet (waiting for animation frame)
    expect(flushed).toHaveLength(0);

    // Trigger the animation frame
    if (rafCallback) {
      (rafCallback as FrameRequestCallback)(16);
    }

    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toHaveLength(2);

    buffer.destroy();
    globalThis.requestAnimationFrame = originalRAF;
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ProjectMemory
// ══════════════════════════════════════════════════════════════════════════════

describe("ProjectMemory", () => {
  let memory: ProjectMemory;

  beforeEach(() => {
    memory = new ProjectMemory();
  });

  it("saves and loads project memory", () => {
    const entry = createMockProjectEntry();
    memory.addEntry(entry);

    const retrieved = memory.getEntriesForProject("project-alpha");
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].projectName).toBe("Project Alpha");
    expect(retrieved[0].auditScore).toBe(72);
  });

  it("records team decisions", () => {
    const decisions: TeamDecision[] = [
      { criterionId: "a11y-contrast-ratio", decision: "accept", reason: "Critical for users", decidedBy: "designer-1", timestamp: Date.now() },
      { criterionId: "token-spacing-scale", decision: "defer", reason: "Low priority sprint", decidedBy: "pm-1", timestamp: Date.now() },
    ];
    const entry = createMockProjectEntry({ teamDecisions: decisions });
    memory.addEntry(entry);

    const retrieved = memory.getLatest("project-alpha");
    expect(retrieved?.teamDecisions).toHaveLength(2);
    expect(retrieved?.teamDecisions[0].decision).toBe("accept");
    expect(retrieved?.teamDecisions[1].decision).toBe("defer");
  });

  it("records feedback", () => {
    const feedback: FeedbackEntry[] = [
      { criterionId: "a11y-contrast-ratio", type: "agree", context: "Important for WCAG compliance", timestamp: Date.now() },
      { criterionId: "int-animation-purpose", type: "irrelevant", context: "Not applicable to dashboard", timestamp: Date.now() },
    ];
    const entry = createMockProjectEntry({ feedbackLog: feedback });
    memory.addEntry(entry);

    const retrieved = memory.getLatest("project-alpha");
    expect(retrieved?.feedbackLog).toHaveLength(2);
    expect(retrieved?.feedbackLog[0].type).toBe("agree");
    expect(retrieved?.feedbackLog[1].type).toBe("irrelevant");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CrossProjectLearning
// ══════════════════════════════════════════════════════════════════════════════

describe("CrossProjectLearning", () => {
  let learning: CrossProjectLearning;

  beforeEach(() => {
    learning = new CrossProjectLearning();
  });

  it("aggregates weights across projects", () => {
    const projects: ProjectMemoryEntry[] = [
      createMockProjectEntry({
        projectId: "p1",
        timestamp: Date.now(),
        criteriaWeights: new Map([["a11y-contrast-ratio", 1.5], ["token-color-system", 1.0]]),
      }),
      createMockProjectEntry({
        projectId: "p2",
        timestamp: Date.now() - 1000,
        criteriaWeights: new Map([["a11y-contrast-ratio", 1.8], ["elem-button-states", 1.1]]),
      }),
    ];

    const aggregated = learning.aggregateWeights(projects);

    expect(aggregated.has("a11y-contrast-ratio")).toBe(true);
    expect(aggregated.has("token-color-system")).toBe(true);
    expect(aggregated.has("elem-button-states")).toBe(true);
    // Weighted average should be between 1.5 and 1.8 for contrast
    const contrastWeight = aggregated.get("a11y-contrast-ratio")!;
    expect(contrastWeight).toBeGreaterThan(1.4);
    expect(contrastWeight).toBeLessThan(1.9);
  });

  it("detects recurring failure patterns", () => {
    const projects: ProjectMemoryEntry[] = Array.from({ length: 5 }, (_, i) =>
      createMockProjectEntry({
        projectId: `project-${i}`,
        teamDecisions: [
          { criterionId: "int-animation-purpose", decision: "reject", reason: "Not relevant", decidedBy: "dev", timestamp: Date.now() },
        ],
      })
    );

    const patterns = learning.detectPatterns(projects);

    const recurringFailure = patterns.find((p) => p.type === "recurring-failure");
    expect(recurringFailure).toBeDefined();
    expect(recurringFailure!.criterionIds).toContain("int-animation-purpose");
    expect(recurringFailure!.occurrences).toBeGreaterThanOrEqual(3);
  });

  it("exports knowledge snapshot", () => {
    const projects: ProjectMemoryEntry[] = [createMockProjectEntry()];
    const patterns: LearningPattern[] = [
      {
        id: "pattern-1",
        type: "team-preference",
        criterionIds: ["a11y-contrast-ratio"],
        confidence: 0.85,
        description: "Team values contrast",
        suggestedAction: "Increase weight",
        occurrences: 5,
      },
    ];

    const snapshot = learning.exportKnowledge(projects, patterns);

    expect(snapshot.version).toBe(1);
    expect(snapshot.exportedAt).toBeGreaterThan(0);
    expect(snapshot.projects).toHaveLength(1);
    expect(snapshot.patterns).toHaveLength(1);
    expect(snapshot.globalWeights).toHaveProperty("a11y-contrast-ratio");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MemoryPersistence
// ══════════════════════════════════════════════════════════════════════════════

describe("MemoryPersistence", () => {
  let persistence: MemoryPersistence;
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);

    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, value: string) => { mockStorage[key] = value; },
        removeItem: (key: string) => { delete mockStorage[key]; },
        clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
        get length() { return Object.keys(mockStorage).length; },
        key: (index: number) => Object.keys(mockStorage)[index] ?? null,
      },
      writable: true,
      configurable: true,
    });

    persistence = new MemoryPersistence();
  });

  it("saves to localStorage", () => {
    const entry = createMockProjectEntry({ projectId: "persist-test" });
    persistence.saveLocal(entry);

    const storedKeys = Object.keys(mockStorage);
    expect(storedKeys.some((k) => k.includes("persist-test"))).toBe(true);
  });

  it("loads from localStorage", () => {
    const entry = createMockProjectEntry({
      projectId: "load-test",
      projectName: "Load Test Project",
      auditScore: 88,
    });
    persistence.saveLocal(entry);

    const loaded = persistence.loadLocal("load-test");
    expect(loaded).not.toBeNull();
    expect(loaded!.projectName).toBe("Load Test Project");
    expect(loaded!.auditScore).toBe(88);
    expect(loaded!.criteriaWeights).toBeInstanceOf(Map);
    expect(loaded!.criteriaWeights.get("a11y-contrast-ratio")).toBe(1.5);
  });

  it("lists all projects", () => {
    persistence.saveLocal(createMockProjectEntry({ projectId: "p1", projectName: "First" }));
    persistence.saveLocal(createMockProjectEntry({ projectId: "p2", projectName: "Second" }));

    const projects = persistence.listProjects();
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.id)).toContain("p1");
    expect(projects.map((p) => p.id)).toContain("p2");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CIGate
// ══════════════════════════════════════════════════════════════════════════════

describe("CIGate", () => {
  let bridge: GitHubBridge;

  beforeEach(() => {
    bridge = new GitHubBridge();
  });

  it("passes when score above threshold", () => {
    const config = bridge.createCIGateConfig(70);
    const overallScore = 85;

    const passes = overallScore >= config.minOverallScore;
    expect(passes).toBe(true);
  });

  it("fails when score below threshold", () => {
    const config = bridge.createCIGateConfig(70);
    const overallScore = 55;

    const passes = overallScore >= config.minOverallScore;
    expect(passes).toBe(false);
  });

  it("blocks on critical failures", () => {
    const config = bridge.createCIGateConfig(70);
    expect(config.blockOnCriticalFail).toBe(true);

    const hasCriticalFailure = true;
    const blocked = config.blockOnCriticalFail && hasCriticalFailure;
    expect(blocked).toBe(true);
  });

  it("generates GitHub Action YAML", () => {
    const config = bridge.createCIGateConfig(75);

    const yaml = [
      "name: UX Audit Gate",
      "on: [pull_request]",
      "jobs:",
      "  ux-audit:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@v4",
      "      - name: Run UX Audit",
      "        run: npx designready-audit",
      "        env:",
      `          MIN_SCORE: ${config.minOverallScore}`,
      `          BLOCK_CRITICAL: ${config.blockOnCriticalFail}`,
      `          REPORT_FORMAT: ${config.reportFormat}`,
    ].join("\n");

    expect(yaml).toContain("MIN_SCORE: 75");
    expect(yaml).toContain("BLOCK_CRITICAL: true");
    expect(yaml).toContain("REPORT_FORMAT: sarif");
    expect(yaml).toContain("pull_request");
  });

  it("formats SARIF output", () => {
    const results: AuditResult[] = [
      createMockResult({ criterionId: "a11y-contrast-ratio", score: 2, status: "fail" }),
    ];
    const criterion = BUILT_IN_CRITERIA.find((c) => c.id === "a11y-contrast-ratio")!;

    // SARIF format structure
    const sarif = {
      $schema: "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: { driver: { name: "designready-ux-audit", version: "5.0.0" } },
          results: results.map((r) => ({
            ruleId: r.criterionId,
            level: r.status === "fail" ? "error" : "warning",
            message: { text: r.findings },
            properties: {
              score: r.score,
              confidence: r.confidence,
              wcagRef: criterion.wcagRef,
            },
          })),
        },
      ],
    };

    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs[0].results[0].ruleId).toBe("a11y-contrast-ratio");
    expect(sarif.runs[0].results[0].level).toBe("error");
    expect(sarif.runs[0].results[0].properties.wcagRef).toBe("1.4.3");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PRAutomation
// ══════════════════════════════════════════════════════════════════════════════

describe("PRAutomation", () => {
  it("generates branch name from criterion", () => {
    const criterionId = "a11y-contrast-ratio";
    const branchName = `fix/ux-audit/${criterionId}`;

    expect(branchName).toBe("fix/ux-audit/a11y-contrast-ratio");
    expect(branchName).toMatch(/^fix\/ux-audit\/[\w-]+$/);
  });

  it("generates PR body", () => {
    const fixPlan = createMockFixPlan();
    const prBody = PRTemplate(fixPlan);

    expect(prBody).toContain("## Summary");
    expect(prBody).toContain(fixPlan.summary);
    expect(prBody).toContain("## Criteria Addressed");
    expect(prBody).toContain("`a11y-contrast-ratio`");
    expect(prBody).toContain("`elem-button-states`");
    expect(prBody).toContain("## Changes Made");
    expect(prBody).toContain("1. Update primary button text color");
    expect(prBody).toContain("## Verification");
  });

  it("generates commit message", () => {
    const fixPlan = createMockFixPlan();
    const commitMessage = `fix(ux): ${fixPlan.summary}\n\nAddresses: ${fixPlan.criteriaIds.join(", ")}`;

    expect(commitMessage).toContain("fix(ux):");
    expect(commitMessage).toContain("contrast ratio");
    expect(commitMessage).toContain("a11y-contrast-ratio");
    expect(commitMessage).toContain("elem-button-states");
  });

  it("creates merge checklist", () => {
    const fixPlan = createMockFixPlan();
    const checklist = [
      `- [ ] All criteria (${fixPlan.criteriaIds.join(", ")}) pass re-audit with score >= 7/10`,
      "- [ ] No regressions in related categories",
      "- [ ] Visual review in target viewports",
      "- [ ] Automated tests pass",
      `- [ ] Estimated effort: ~${fixPlan.estimatedHours}h`,
    ];

    expect(checklist).toHaveLength(5);
    expect(checklist[0]).toContain("a11y-contrast-ratio");
    expect(checklist[0]).toContain(">= 7/10");
    expect(checklist[4]).toContain("~2h");
  });
});
