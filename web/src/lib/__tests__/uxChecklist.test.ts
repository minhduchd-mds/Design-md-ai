/**
 * Tests for ux-checklist/ — Agentic UI/UX Auditor v4
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  UXChecklistOrchestrator,
  CriteriaRegistry,
  AuditAgent,
  ScoreAgent,
  RecommendAgent,
  LearningLoop,
  BUILT_IN_CRITERIA,
  DEFAULT_CHECKLIST_CONFIG,
  type AuditCriterion,
  type AuditResult,
} from "../../ux-checklist";
import { EvidenceMemoryEngine } from "../evidenceMemory";
import { GOAPPlanner } from "../goapPlanner";

describe("UXChecklistOrchestrator", () => {
  let orchestrator: UXChecklistOrchestrator;

  beforeEach(() => {
    orchestrator = new UXChecklistOrchestrator();
    orchestrator.registerCriteria(BUILT_IN_CRITERIA);
  });

  describe("initialization", () => {
    it("creates with default config", () => {
      const config = orchestrator.getConfig();
      expect(config.enableLearning).toBe(true);
      expect(config.enableAutoPlan).toBe(true);
      expect(config.autoPassThreshold).toBe(0.85);
      expect(config.activeSources.length).toBe(4);
    });

    it("loads built-in criteria", () => {
      expect(orchestrator.getCriteriaCount()).toBe(BUILT_IN_CRITERIA.length);
    });

    it("accepts custom config", () => {
      const custom = new UXChecklistOrchestrator({ enableLearning: false, maxCriteriaPerRun: 10 });
      expect(custom.getConfig().enableLearning).toBe(false);
      expect(custom.getConfig().maxCriteriaPerRun).toBe(10);
    });
  });

  describe("criteria management", () => {
    it("registers custom criterion", () => {
      const initial = orchestrator.getCriteriaCount();
      orchestrator.addCustomCriterion({
        id: "custom-test-1",
        title: "Custom check",
        description: "A custom user-defined check",
        source: "custom",
        category: "interaction",
        severity: "minor",
        tags: ["custom"],
        automatable: false,
      });
      expect(orchestrator.getCriteriaCount()).toBe(initial + 1);
    });

    it("getCriteria returns sorted by impact", () => {
      const criteria = orchestrator.getCriteria();
      expect(criteria.length).toBeGreaterThan(0);
      // First criterion should have high confidence × weight
      expect(criteria[0].confidence * criteria[0].learnedWeight).toBeGreaterThanOrEqual(
        criteria[criteria.length - 1].confidence * criteria[criteria.length - 1].learnedWeight,
      );
    });

    it("filters by active sources", () => {
      orchestrator.configure({ activeSources: ["wcag"] });
      const criteria = orchestrator.getCriteria();
      expect(criteria.every(c => c.source === "wcag")).toBe(true);
    });

    it("filters by severity", () => {
      orchestrator.configure({ minSeverity: "critical" });
      const criteria = orchestrator.getCriteria();
      expect(criteria.every(c => c.severity === "critical")).toBe(true);
    });
  });

  describe("audit execution", () => {
    it("runs audit and returns report", async () => {
      const report = await orchestrator.runAudit({ type: "mock-design" }, "Test Project");
      expect(report.id).toContain("audit-");
      expect(report.projectName).toBe("Test Project");
      expect(report.results.length).toBeGreaterThan(0);
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.timestamp).toBeGreaterThan(0);
    });

    it("stores audit in history", async () => {
      await orchestrator.runAudit({}, "Project A");
      await orchestrator.runAudit({}, "Project B");
      expect(orchestrator.getHistory().length).toBe(2);
    });

    it("latest report matches last audit", async () => {
      await orchestrator.runAudit({}, "Latest");
      const latest = orchestrator.getLatestReport();
      expect(latest?.projectName).toBe("Latest");
    });

    it("reports contain category scores", async () => {
      const report = await orchestrator.runAudit({}, "CatTest");
      expect(report.categoryScores.size).toBeGreaterThan(0);
    });

    it("detects contradictions between sources", async () => {
      // Register contradicting criteria
      orchestrator.registerCriteria([
        {
          id: "contra-a",
          title: "Button height 32px",
          description: "Buttons should be 32px",
          source: "vts",
          category: "button",
          severity: "major",
          confidence: 0.9,
          validationCount: 50,
          tags: ["button", "height", "size", "interactive"],
          automatable: true,
          learnedWeight: 1.0,
        },
        {
          id: "contra-b",
          title: "Button height 40px",
          description: "Buttons should be 40px",
          source: "material3",
          category: "button",
          severity: "major",
          confidence: 0.9,
          validationCount: 50,
          tags: ["button", "height", "size", "interactive"],
          automatable: true,
          learnedWeight: 1.0,
        },
      ]);
      const stats = orchestrator.getLearningStats();
      expect(stats.contradictions).toBeGreaterThan(0);
    });
  });

  describe("GOAP planning", () => {
    it("plans audit order", () => {
      const criteria = orchestrator.getCriteria();
      const plan = orchestrator.planAuditOrder(criteria);
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.estimatedMinutes).toBeGreaterThan(0);
      expect(plan.rationale).toBeTruthy();
    });

    it("prioritizes critical criteria first", () => {
      const criteria = orchestrator.getCriteria();
      const plan = orchestrator.planAuditOrder(criteria);
      const criticalSteps = plan.steps.filter(s => s.priority === 4);
      if (criticalSteps.length > 0) {
        // Critical items should appear before minor items
        const firstCritical = plan.steps.findIndex(s => s.priority === 4);
        const lastMinor = plan.steps.findIndex(s => s.priority === 1);
        if (lastMinor !== -1 && firstCritical !== -1) {
          expect(firstCritical).toBeLessThan(lastMinor);
        }
      }
    });
  });

  describe("feedback & learning", () => {
    it("accepts positive feedback", () => {
      const before = orchestrator.getCriteria().find(c => c.id === "a11y-contrast-ratio")!;
      const beforeCount = before.validationCount;
      orchestrator.feedback("a11y-contrast-ratio", "agree");
      const after = orchestrator.getCriteria().find(c => c.id === "a11y-contrast-ratio")!;
      expect(after.validationCount).toBe(beforeCount + 1);
    });

    it("accepts negative feedback", () => {
      const before = orchestrator.getCriteria().find(c => c.id === "token-elevation-system");
      const beforeWeight = before!.learnedWeight;
      orchestrator.feedback("token-elevation-system", "disagree");
      const after = orchestrator.getCriteria().find(c => c.id === "token-elevation-system");
      expect(after!.learnedWeight).toBeLessThan(beforeWeight);
    });

    it("irrelevant feedback heavily penalizes", () => {
      const before = orchestrator.getCriteria().find(c => c.id === "int-animation-purpose");
      const beforeWeight = before!.learnedWeight;
      orchestrator.feedback("int-animation-purpose", "irrelevant");
      const after = orchestrator.getCriteria().find(c => c.id === "int-animation-purpose");
      expect(after!.learnedWeight).toBeLessThan(beforeWeight - 0.1);
    });

    it("returns learning stats", () => {
      const stats = orchestrator.getLearningStats();
      expect(stats.totalAudits).toBeDefined();
      expect(stats.criteriaCount).toBeGreaterThan(0);
    });
  });

  describe("configuration", () => {
    it("updates config", () => {
      orchestrator.configure({ decayRate: 0.1, maxCriteriaPerRun: 20 });
      expect(orchestrator.getConfig().decayRate).toBe(0.1);
      expect(orchestrator.getConfig().maxCriteriaPerRun).toBe(20);
    });
  });
});

describe("CriteriaRegistry", () => {
  it("registers and retrieves criteria", () => {
    // EvidenceMemoryEngine imported at top
    const registry = new CriteriaRegistry(new EvidenceMemoryEngine());
    registry.register({
      id: "test-1",
      title: "Test",
      description: "Desc",
      source: "custom",
      category: "foundation",
      severity: "minor",
      confidence: 0.8,
      validationCount: 0,
      tags: ["test"],
      automatable: false,
      learnedWeight: 1.0,
    });
    expect(registry.get("test-1")).toBeDefined();
    expect(registry.size).toBe(1);
  });

  it("validates criteria with boost", () => {
    // EvidenceMemoryEngine imported at top
    const registry = new CriteriaRegistry(new EvidenceMemoryEngine());
    registry.register({
      id: "v-1",
      title: "V",
      description: "D",
      source: "wcag",
      category: "accessibility",
      severity: "critical",
      confidence: 0.5,
      validationCount: 0,
      tags: [],
      automatable: true,
      learnedWeight: 1.0,
    });
    registry.validate("v-1", true);
    const after = registry.get("v-1")!;
    expect(after.confidence).toBe(0.55);
    expect(after.validationCount).toBe(1);
  });
});

describe("BUILT_IN_CRITERIA", () => {
  it("has 19 criteria defined", () => {
    expect(BUILT_IN_CRITERIA.length).toBe(19);
  });

  it("each criterion has required fields", () => {
    for (const c of BUILT_IN_CRITERIA) {
      expect(c.id).toBeTruthy();
      expect(c.title).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(c.source).toBeTruthy();
      expect(c.category).toBeTruthy();
      expect(c.severity).toBeTruthy();
      expect(c.confidence).toBeGreaterThan(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
      expect(c.learnedWeight).toBeGreaterThan(0);
      expect(c.tags.length).toBeGreaterThan(0);
    }
  });

  it("has WCAG criteria with wcagRef", () => {
    const wcag = BUILT_IN_CRITERIA.filter(c => c.source === "wcag");
    expect(wcag.length).toBeGreaterThan(0);
    expect(wcag.every(c => c.wcagRef !== undefined)).toBe(true);
  });

  it("critical criteria have high confidence", () => {
    const critical = BUILT_IN_CRITERIA.filter(c => c.severity === "critical");
    expect(critical.every(c => c.confidence >= 0.9)).toBe(true);
  });

  it("covers all 4 sources", () => {
    const sources = new Set(BUILT_IN_CRITERIA.map(c => c.source));
    expect(sources.has("wcag")).toBe(true);
    expect(sources.has("material3")).toBe(true);
    expect(sources.has("ant-design")).toBe(true);
    expect(sources.has("vts")).toBe(true);
  });
});

describe("AuditAgent", () => {
  it("audits design against criteria", async () => {
    const agent = new AuditAgent();
    const criteria: AuditCriterion[] = [BUILT_IN_CRITERIA[0]]; // contrast ratio
    const results = await agent.audit({ mockDesign: true }, criteria);
    expect(results.length).toBe(1);
    expect(results[0].criterionId).toBe("a11y-contrast-ratio");
    expect(results[0].agentId).toBe("ux-audit-agent");
    expect(results[0].status).toBeDefined();
    expect(results[0].score).toBeGreaterThanOrEqual(0);
  });

  it("only evaluates automatable criteria", async () => {
    const agent = new AuditAgent();
    const criteria: AuditCriterion[] = [
      BUILT_IN_CRITERIA.find(c => c.automatable)!,
      BUILT_IN_CRITERIA.find(c => !c.automatable)!,
    ];
    const results = await agent.audit({}, criteria);
    // Should only evaluate the automatable one
    expect(results.length).toBe(1);
    expect(results[0].criterionId).toBe(criteria[0].id);
  });
});

describe("RecommendAgent", () => {
  it("generates improvement plan from results", () => {
    // GOAPPlanner imported at top
    const agent = new RecommendAgent(new GOAPPlanner());
    const results: AuditResult[] = [
      {
        criterionId: "a11y-contrast-ratio",
        status: "fail",
        score: 3,
        confidence: 0.8,
        findings: "Low contrast",
        recommendation: "Increase contrast",
        agentId: "test",
        timestamp: Date.now(),
        metadata: {},
      },
      {
        criterionId: "token-spacing-scale",
        status: "warn",
        score: 6,
        confidence: 0.7,
        findings: "Some spacing off",
        recommendation: "Align to grid",
        agentId: "test",
        timestamp: Date.now(),
        metadata: {},
      },
    ];
    const criteriaMap = new Map(BUILT_IN_CRITERIA.map(c => [c.id, c]));
    const plan = agent.planImprovements(results, criteriaMap);
    expect(plan.steps.length).toBe(2);
    expect(plan.steps[0].estimatedImpact).toBeGreaterThan(plan.steps[1].estimatedImpact);
    expect(plan.estimatedMinutes).toBeGreaterThan(0);
  });
});
