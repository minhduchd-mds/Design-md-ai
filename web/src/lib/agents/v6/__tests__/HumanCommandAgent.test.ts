import { describe, it, expect, vi } from "vitest";
import { HumanCommandAgent } from "../command/HumanCommandAgent";
import type { AgentContextV6 } from "../BaseAgent";

function makeCtx(): AgentContextV6 {
  return {
    runId: "r1", projectId: "p1", costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

describe("HumanCommandAgent", () => {
  it("parses 'audit src/components' into audit mission", async () => {
    const agent = new HumanCommandAgent();
    const result = await agent.execute(
      { command: "audit src/components" },
      makeCtx(),
    );
    expect(result.output!.mission.type).toBe("audit");
    expect(result.output!.mission.fleets).toContain("audit");
    expect(result.output!.mission.scope).toContain("src/components");
    expect(result.output!.mission.confidence).toBeGreaterThan(0.5);
  });

  it("parses 'fix any types' into fix mission", async () => {
    const agent = new HumanCommandAgent();
    const result = await agent.execute(
      { command: "fix any types in src/lib" },
      makeCtx(),
    );
    expect(result.output!.mission.type).toBe("fix");
    expect(result.output!.mission.fleets).toContain("fix");
    expect(result.output!.mission.policy.requireApproval).toBe(true);
    expect(result.output!.mission.policy.useWorktree).toBe(true);
  });

  it("parses 'test src/lib' into verify mission", async () => {
    const agent = new HumanCommandAgent();
    const result = await agent.execute(
      { command: "test src/lib" },
      makeCtx(),
    );
    expect(result.output!.mission.type).toBe("test");
    expect(result.output!.mission.fleets).toContain("verify");
  });

  it("parses 'map repo' into map mission", async () => {
    const agent = new HumanCommandAgent();
    const result = await agent.execute(
      { command: "map repo" },
      makeCtx(),
    );
    expect(result.output!.mission.type).toBe("map-repo");
    expect(result.output!.mission.fleets).toContain("map");
  });

  it("parses 'check accessibility' into audit mission", async () => {
    const agent = new HumanCommandAgent();
    const result = await agent.execute(
      { command: "check accessibility" },
      makeCtx(),
    );
    expect(result.output!.mission.type).toBe("audit");
  });

  it("parses 'benchmark agents' into benchmark mission", async () => {
    const agent = new HumanCommandAgent();
    const result = await agent.execute(
      { command: "benchmark agents" },
      makeCtx(),
    );
    expect(result.output!.mission.type).toBe("benchmark");
    expect(result.output!.mission.fleets).toContain("self-improve");
  });

  it("handles unknown commands with low confidence", async () => {
    const agent = new HumanCommandAgent();
    const result = await agent.execute(
      { command: "do something random" },
      makeCtx(),
    );
    expect(result.output!.mission.type).toBe("unknown");
    expect(result.output!.mission.confidence).toBeLessThan(0.5);
    expect(result.output!.suggestions.length).toBeGreaterThan(0);
  });

  it("uses context.currentFile as scope fallback", async () => {
    const agent = new HumanCommandAgent();
    const result = await agent.execute(
      { command: "audit", context: { currentFile: "src/App.tsx" } },
      makeCtx(),
    );
    expect(result.output!.mission.scope).toContain("src/App.tsx");
  });

  it("generates a human-readable summary", async () => {
    const agent = new HumanCommandAgent();
    const result = await agent.execute(
      { command: "fix any types" },
      makeCtx(),
    );
    expect(result.output!.summary).toContain("fix");
    expect(result.output!.summary.length).toBeGreaterThan(10);
  });

  it("assigns unique mission ID", async () => {
    const agent = new HumanCommandAgent();
    const r1 = await agent.execute({ command: "audit" }, makeCtx());
    const r2 = await agent.execute({ command: "audit" }, makeCtx());
    expect(r1.output!.mission.id).not.toBe(r2.output!.mission.id);
  });
});
