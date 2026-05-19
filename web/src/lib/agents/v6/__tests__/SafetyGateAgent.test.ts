import { describe, it, expect, vi } from "vitest";
import { SafetyGateAgent } from "../safety/SafetyGateAgent";
import type { AgentContextV6 } from "../BaseAgent";

function makeCtx(): AgentContextV6 {
  return {
    runId: "r1", projectId: "p1", costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

describe("SafetyGateAgent", () => {
  it("allows safe, small patches", async () => {
    const agent = new SafetyGateAgent();
    const result = await agent.execute({
      files: ["src/lib/utils.ts"],
      diff: "-const x: any = 1;\n+const x: unknown = 1;\n",
      agentId: "self-improve.refactor",
      declaredRisk: "low",
    }, makeCtx());
    expect(result.output!.verdict).toBe("allow");
    expect(result.output!.blockers).toHaveLength(0);
  });

  it("blocks patches touching protected files", async () => {
    const agent = new SafetyGateAgent();
    const result = await agent.execute({
      files: [".env.local", "src/utils.ts"],
      diff: "+API_KEY=secret\n",
      agentId: "fix.code-fix",
      declaredRisk: "low",
    }, makeCtx());
    expect(result.output!.verdict).toBe("block");
    expect(result.output!.blockers.some((v) => v.rule === "protected-file")).toBe(true);
  });

  it("blocks patches exceeding max files", async () => {
    const agent = new SafetyGateAgent();
    const files = Array.from({ length: 15 }, (_, i) => `src/file${i}.ts`);
    const result = await agent.execute({
      files,
      diff: "+changed\n",
      agentId: "fix.code-fix",
      declaredRisk: "low",
    }, makeCtx());
    expect(result.output!.verdict).toBe("block");
    expect(result.output!.blockers.some((v) => v.rule === "max-files")).toBe(true);
  });

  it("detects secrets in diff (API key pattern)", async () => {
    const agent = new SafetyGateAgent();
    const result = await agent.execute({
      files: ["src/config.ts"],
      diff: '+const apiKey = "sk-1234567890abcdef1234567890abcdef12";\n',
      agentId: "fix.code-fix",
      declaredRisk: "low",
    }, makeCtx());
    expect(result.output!.verdict).toBe("block");
    expect(result.output!.blockers.some((v) => v.rule === "secret-leak")).toBe(true);
  });

  it("detects AWS access key in diff", async () => {
    const agent = new SafetyGateAgent();
    const result = await agent.execute({
      files: ["src/aws.ts"],
      diff: '+const key = "AKIAIOSFODNN7EXAMPLE";\n',
      agentId: "test",
      declaredRisk: "low",
    }, makeCtx());
    expect(result.output!.blockers.some((v) => v.rule === "secret-leak")).toBe(true);
  });

  it("warns on high-risk with blockHighRisk policy", async () => {
    const agent = new SafetyGateAgent();
    const result = await agent.execute({
      files: ["src/lib/utils.ts"],
      diff: "-old\n+new\n",
      agentId: "self-improve.refactor",
      declaredRisk: "high",
    }, makeCtx());
    expect(result.output!.verdict).toBe("needs-approval");
    expect(result.output!.warnings.some((v) => v.rule === "high-risk")).toBe(true);
  });

  it("respects custom policy overrides", async () => {
    const agent = new SafetyGateAgent();
    const result = await agent.execute({
      files: Array.from({ length: 20 }, (_, i) => `src/f${i}.ts`),
      diff: "+x\n",
      agentId: "test",
      declaredRisk: "low",
      policy: { maxFiles: 50 },
    }, makeCtx());
    // 20 files < 50 max, so no max-files violation
    expect(result.output!.blockers.every((v) => v.rule !== "max-files")).toBe(true);
  });

  it("blocks CI workflow modifications", async () => {
    const agent = new SafetyGateAgent();
    const result = await agent.execute({
      files: [".github/workflows/ci.yml"],
      diff: "+step: hack\n",
      agentId: "fix.code-fix",
      declaredRisk: "low",
    }, makeCtx());
    expect(result.output!.verdict).toBe("block");
    expect(result.output!.blockers.some((v) => v.file === ".github/workflows/ci.yml")).toBe(true);
  });
});
