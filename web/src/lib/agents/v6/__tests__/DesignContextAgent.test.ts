import { describe, it, expect, vi } from "vitest";
import {
  DesignContextAgent,
  type DesignIssue,
  type DesignContextInput,
} from "../map/DesignContextAgent";
import type { AgentContextV6 } from "../BaseAgent";

function makeCtx(): AgentContextV6 {
  return {
    runId: "r1", projectId: "p1", costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

function makeIssue(overrides: Partial<DesignIssue> = {}): DesignIssue {
  return {
    id: "i1",
    category: "naming",
    severity: "warning",
    message: "Component has a generic name",
    nodePath: "Page > Section > Button/Primary",
    ...overrides,
  };
}

describe("DesignContextAgent", () => {
  it("extracts component names from input", async () => {
    const agent = new DesignContextAgent();
    const input: DesignContextInput = {
      source: "figma-file.fig",
      score: 75,
      issues: [],
      components: [
        { name: "Button", type: "COMPONENT" },
        { name: "NavBar", type: "COMPONENT_SET", variantCount: 3 },
      ],
    };
    const result = await agent.execute(input, makeCtx());
    expect(result.output!.componentNames).toEqual(["Button", "NavBar"]);
  });

  it("extracts token names from input", async () => {
    const agent = new DesignContextAgent();
    const input: DesignContextInput = {
      source: "design.fig",
      score: 80,
      issues: [],
      tokens: [
        { name: "color-brand-primary", collection: "Colors", type: "COLOR", value: "#FF0000" },
        { name: "space-md", collection: "Spacing", type: "FLOAT", value: "16" },
      ],
    };
    const result = await agent.execute(input, makeCtx());
    expect(result.output!.tokenNames).toEqual(["color-brand-primary", "space-md"]);
  });

  it("prioritizes issues by severity (critical first)", async () => {
    const agent = new DesignContextAgent();
    const issues: DesignIssue[] = [
      makeIssue({ id: "w1", severity: "warning", message: "warn msg" }),
      makeIssue({ id: "c1", severity: "critical", message: "critical msg" }),
      makeIssue({ id: "i1", severity: "info", message: "info msg" }),
    ];
    const result = await agent.execute({ source: "test", score: 50, issues }, makeCtx());
    expect(result.output!.prioritized.critical).toHaveLength(1);
    expect(result.output!.prioritized.warning).toHaveLength(1);
    expect(result.output!.prioritized.info).toHaveLength(1);
    // Actionable issues should have critical first
    expect(result.output!.context.actionableIssues[0].severity).toBe("critical");
  });

  it("limits actionable issues to top 20", async () => {
    const agent = new DesignContextAgent();
    const issues = Array.from({ length: 30 }, (_, i) =>
      makeIssue({ id: `issue-${i}`, severity: "warning", message: `Issue ${i}` }),
    );
    const result = await agent.execute({ source: "test", score: 40, issues }, makeCtx());
    expect(result.output!.context.actionableIssues.length).toBe(20);
    expect(result.output!.context.issueCount).toBe(30);
  });

  it("extracts component name from Figma node path", async () => {
    const agent = new DesignContextAgent();
    const issues: DesignIssue[] = [
      makeIssue({
        id: "n1",
        nodePath: "Page > Section > Card/Hover",
        severity: "critical",
        message: "Missing states",
      }),
    ];
    const result = await agent.execute({ source: "test", score: 60, issues }, makeCtx());
    expect(result.output!.context.actionableIssues[0].componentName).toBe("Card");
  });

  it("extracts token name from issue message", async () => {
    const agent = new DesignContextAgent();
    const issues: DesignIssue[] = [
      makeIssue({
        id: "t1",
        severity: "warning",
        message: "Hardcoded color — bind to token 'color-brand-primary' instead",
      }),
    ];
    const result = await agent.execute({ source: "test", score: 70, issues }, makeCtx());
    expect(result.output!.context.actionableIssues[0].tokenName).toBe("color-brand-primary");
  });

  it("infers action from category when no suggestion provided", async () => {
    const agent = new DesignContextAgent();
    const issues: DesignIssue[] = [
      makeIssue({ id: "a1", category: "naming", severity: "critical" }),
      makeIssue({ id: "a2", category: "tokens", severity: "critical" }),
      makeIssue({ id: "a3", category: "completeness", severity: "critical" }),
    ];
    const result = await agent.execute({ source: "test", score: 50, issues }, makeCtx());
    const actions = result.output!.context.actionableIssues.map((a) => a.suggestedAction);
    expect(actions[0]).toContain("Rename");
    expect(actions[1]).toContain("token");
    expect(actions[2]).toContain("missing");
  });

  it("uses suggestion text when provided", async () => {
    const agent = new DesignContextAgent();
    const issues: DesignIssue[] = [
      makeIssue({
        id: "s1",
        severity: "critical",
        suggestion: "Rename to 'PrimaryButton'",
      }),
    ];
    const result = await agent.execute({ source: "test", score: 60, issues }, makeCtx());
    expect(result.output!.context.actionableIssues[0].suggestedAction).toBe("Rename to 'PrimaryButton'");
  });

  it("includes a11y data when provided", async () => {
    const agent = new DesignContextAgent();
    const result = await agent.execute({
      source: "test",
      score: 65,
      issues: [],
      a11yScore: 82,
      a11yViolations: 5,
    }, makeCtx());
    expect(result.output!.context.a11y).toEqual({ score: 82, violations: 5 });
  });

  it("a11y is null when not provided", async () => {
    const agent = new DesignContextAgent();
    const result = await agent.execute({
      source: "test",
      score: 70,
      issues: [],
    }, makeCtx());
    expect(result.output!.context.a11y).toBeNull();
  });

  it("skips generic Frame/Group names in component extraction", async () => {
    const agent = new DesignContextAgent();
    const issues: DesignIssue[] = [
      makeIssue({ id: "g1", nodePath: "Page > Frame 1", severity: "critical" }),
      makeIssue({ id: "g2", nodePath: "Page > Group 2", severity: "critical" }),
    ];
    const result = await agent.execute({ source: "test", score: 50, issues }, makeCtx());
    result.output!.context.actionableIssues.forEach((a) => {
      expect(a.componentName).toBeNull();
    });
  });
});
