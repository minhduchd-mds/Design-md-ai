import { describe, it, expect, vi } from "vitest";
import { ConflictResolverAgent, type PatchHunk } from "../safety/ConflictResolverAgent";
import type { AgentContextV6 } from "../BaseAgent";

function makeCtx(): AgentContextV6 {
  return {
    runId: "r1", projectId: "p1", costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

function makeHunk(overrides: Partial<PatchHunk> = {}): PatchHunk {
  return {
    file: "src/utils.ts",
    startLine: 1,
    lineCount: 5,
    content: "-old\n+new\n",
    agentId: "agent-a",
    priority: 1,
    ...overrides,
  };
}

describe("ConflictResolverAgent", () => {
  it("detects no conflicts when hunks are in different files", async () => {
    const agent = new ConflictResolverAgent();
    const result = await agent.execute({
      hunks: [
        makeHunk({ file: "a.ts", agentId: "a1" }),
        makeHunk({ file: "b.ts", agentId: "a2" }),
      ],
    }, makeCtx());
    expect(result.output!.conflicts).toHaveLength(0);
    expect(result.output!.safeHunks).toHaveLength(2);
  });

  it("detects same-region conflict when line ranges overlap", async () => {
    const agent = new ConflictResolverAgent();
    const result = await agent.execute({
      hunks: [
        makeHunk({ file: "a.ts", startLine: 10, lineCount: 10, agentId: "x" }),
        makeHunk({ file: "a.ts", startLine: 15, lineCount: 10, agentId: "y" }),
      ],
    }, makeCtx());
    expect(result.output!.conflicts).toHaveLength(1);
    expect(result.output!.conflicts[0].type).toBe("same-region");
  });

  it("detects adjacent conflict when hunks are within 3 lines", async () => {
    const agent = new ConflictResolverAgent();
    const result = await agent.execute({
      hunks: [
        makeHunk({ file: "a.ts", startLine: 10, lineCount: 5, agentId: "x" }),
        makeHunk({ file: "a.ts", startLine: 17, lineCount: 5, agentId: "y" }),
      ],
    }, makeCtx());
    expect(result.output!.conflicts).toHaveLength(1);
    expect(result.output!.conflicts[0].type).toBe("adjacent");
  });

  it("no conflict when hunks are far apart in same file", async () => {
    const agent = new ConflictResolverAgent();
    const result = await agent.execute({
      hunks: [
        makeHunk({ file: "a.ts", startLine: 1, lineCount: 5, agentId: "x" }),
        makeHunk({ file: "a.ts", startLine: 100, lineCount: 5, agentId: "y" }),
      ],
    }, makeCtx());
    expect(result.output!.conflicts).toHaveLength(0);
  });

  it("auto-resolves same-region by priority (lower wins)", async () => {
    const agent = new ConflictResolverAgent();
    const result = await agent.execute({
      hunks: [
        makeHunk({ file: "a.ts", startLine: 10, lineCount: 10, agentId: "low", priority: 2 }),
        makeHunk({ file: "a.ts", startLine: 15, lineCount: 10, agentId: "high", priority: 1 }),
      ],
      strategy: "priority",
    }, makeCtx());
    expect(result.output!.conflicts[0].resolved).toBe(true);
    expect(result.output!.conflicts[0].winner!.agentId).toBe("high");
    expect(result.output!.conflicts[0].resolution).toBe("auto-priority");
  });

  it("auto-resolves with first-wins strategy", async () => {
    const agent = new ConflictResolverAgent();
    const result = await agent.execute({
      hunks: [
        makeHunk({ file: "a.ts", startLine: 10, lineCount: 10, agentId: "first", priority: 5 }),
        makeHunk({ file: "a.ts", startLine: 15, lineCount: 10, agentId: "second", priority: 1 }),
      ],
      strategy: "first-wins",
    }, makeCtx());
    expect(result.output!.conflicts[0].winner!.agentId).toBe("first");
    expect(result.output!.conflicts[0].resolution).toBe("auto-first-wins");
  });

  it("reject-all puts everything in manualReview", async () => {
    const agent = new ConflictResolverAgent();
    const result = await agent.execute({
      hunks: [
        makeHunk({ file: "a.ts", startLine: 10, lineCount: 10, agentId: "x" }),
        makeHunk({ file: "a.ts", startLine: 15, lineCount: 10, agentId: "y" }),
      ],
      strategy: "reject-all",
    }, makeCtx());
    expect(result.output!.conflicts[0].resolved).toBe(false);
    expect(result.output!.manualReview).toHaveLength(1);
  });

  it("whole-file conflicts always need manual review", async () => {
    const agent = new ConflictResolverAgent();
    const result = await agent.execute({
      hunks: [
        makeHunk({ file: "a.ts", startLine: 1, lineCount: 100, agentId: "x" }),
        makeHunk({ file: "a.ts", startLine: 1, lineCount: 80, agentId: "y" }),
      ],
      strategy: "priority",
    }, makeCtx());
    expect(result.output!.conflicts[0].type).toBe("whole-file");
    expect(result.output!.conflicts[0].resolved).toBe(false);
    expect(result.output!.manualReview).toHaveLength(1);
  });

  it("does not treat same-agent hunks as conflicting", async () => {
    const agent = new ConflictResolverAgent();
    const result = await agent.execute({
      hunks: [
        makeHunk({ file: "a.ts", startLine: 10, lineCount: 10, agentId: "same" }),
        makeHunk({ file: "a.ts", startLine: 15, lineCount: 10, agentId: "same" }),
      ],
    }, makeCtx());
    expect(result.output!.conflicts).toHaveLength(0);
  });

  it("computes stats correctly", async () => {
    const agent = new ConflictResolverAgent();
    const result = await agent.execute({
      hunks: [
        makeHunk({ file: "a.ts", startLine: 10, lineCount: 10, agentId: "x", priority: 1 }),
        makeHunk({ file: "a.ts", startLine: 15, lineCount: 10, agentId: "y", priority: 2 }),
        makeHunk({ file: "b.ts", startLine: 1, lineCount: 5, agentId: "z" }),
      ],
      strategy: "priority",
    }, makeCtx());
    expect(result.output!.stats.totalHunks).toBe(3);
    expect(result.output!.stats.conflictCount).toBe(1);
    expect(result.output!.stats.autoResolved).toBe(1);
    expect(result.output!.stats.filesAffected).toBe(2);
  });

  it("resolvedHunks includes safe hunks + winners", async () => {
    const agent = new ConflictResolverAgent();
    const result = await agent.execute({
      hunks: [
        makeHunk({ file: "a.ts", startLine: 10, lineCount: 10, agentId: "x", priority: 1 }),
        makeHunk({ file: "a.ts", startLine: 15, lineCount: 10, agentId: "y", priority: 2 }),
        makeHunk({ file: "b.ts", startLine: 1, lineCount: 5, agentId: "z" }),
      ],
      strategy: "priority",
    }, makeCtx());
    // safe: b.ts hunk; winner: x (priority 1)
    expect(result.output!.resolvedHunks.length).toBe(2);
    const ids = result.output!.resolvedHunks.map((h) => h.agentId);
    expect(ids).toContain("x");
    expect(ids).toContain("z");
  });
});
