import { describe, it, expect, vi } from "vitest";
import { IssueToTaskAgent, type RawIssue } from "../command/IssueToTaskAgent";
import type { AgentContextV6 } from "../BaseAgent";

function makeCtx(): AgentContextV6 {
  return {
    runId: "r1", projectId: "p1", costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

describe("IssueToTaskAgent", () => {
  it("converts a GitHub bug issue to a fix-code task", async () => {
    const agent = new IssueToTaskAgent();
    const issue: RawIssue = {
      source: "github",
      title: "Fix login button not responding",
      severity: "high",
      labels: ["bug"],
      file: "src/components/LoginButton.tsx",
    };
    const result = await agent.execute({ issues: [issue] }, makeCtx());
    expect(result.output!.tasks).toHaveLength(1);
    expect(result.output!.tasks[0].priority).toBe("p1-high");
    expect(result.output!.tasks[0].action).toBe("fix-code");
    expect(result.output!.tasks[0].scope).toContain("src/components/LoginButton.tsx");
  });

  it("converts a self-diagnostic candidate to medium priority", async () => {
    const agent = new IssueToTaskAgent();
    const issue: RawIssue = {
      source: "self-diagnostic",
      title: "Found `: any` usage in handler.ts",
      file: "src/api/handler.ts",
      line: 12,
    };
    const result = await agent.execute({ issues: [issue] }, makeCtx());
    expect(result.output!.tasks[0].priority).toBe("p2-medium");
    expect(result.output!.tasks[0].action).toBe("refactor");
  });

  it("converts a Figma audit issue to trace task", async () => {
    const agent = new IssueToTaskAgent();
    const issue: RawIssue = {
      source: "figma-audit",
      title: "Component 'Button' has missing states",
      componentName: "Button",
      figmaNodeId: "1:42",
    };
    const result = await agent.execute({ issues: [issue] }, makeCtx());
    expect(result.output!.tasks[0].action).toBe("trace");
    expect(result.output!.tasks[0].fleets).toContain("map");
  });

  it("skips issues with empty titles", async () => {
    const agent = new IssueToTaskAgent();
    const result = await agent.execute({
      issues: [
        { source: "chat", title: "" },
        { source: "chat", title: "Valid issue" },
      ],
    }, makeCtx());
    expect(result.output!.tasks).toHaveLength(1);
    expect(result.output!.skipped).toHaveLength(1);
  });

  it("sorts tasks by priority (critical first)", async () => {
    const agent = new IssueToTaskAgent();
    const issues: RawIssue[] = [
      { source: "github", title: "Low priority cleanup", severity: "low" },
      { source: "github", title: "Critical security fix", severity: "critical" },
      { source: "github", title: "Medium improvement", severity: "medium" },
    ];
    const result = await agent.execute({ issues }, makeCtx());
    expect(result.output!.tasks[0].priority).toBe("p0-critical");
    expect(result.output!.tasks[1].priority).toBe("p2-medium");
    expect(result.output!.tasks[2].priority).toBe("p3-low");
  });

  it("computes stats by priority and action", async () => {
    const agent = new IssueToTaskAgent();
    const issues: RawIssue[] = [
      { source: "github", title: "Fix bug", severity: "high", labels: ["bug"] },
      { source: "self-diagnostic", title: "Refactor any usage" },
      { source: "figma-audit", title: "Trace component NavBar", componentName: "NavBar" },
    ];
    const result = await agent.execute({ issues }, makeCtx());
    expect(result.output!.stats.total).toBe(3);
    expect(Object.keys(result.output!.stats.byPriority).length).toBeGreaterThan(0);
    expect(Object.keys(result.output!.stats.byAction).length).toBeGreaterThan(0);
  });

  it("generates unique task IDs", async () => {
    const agent = new IssueToTaskAgent();
    const result = await agent.execute({
      issues: [
        { source: "chat", title: "Issue A" },
        { source: "chat", title: "Issue B" },
      ],
    }, makeCtx());
    expect(result.output!.tasks[0].id).not.toBe(result.output!.tasks[1].id);
  });
});
