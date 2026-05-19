import { describe, it, expect, vi } from "vitest";
import { ArchitectureDriftAgent } from "../audit/ArchitectureDriftAgent";
import type { FileEntry } from "../map/RepoMapAgent";
import type { AgentContextV6 } from "../BaseAgent";

function makeCtx(): AgentContextV6 {
  return {
    runId: "r1", projectId: "p1", costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

function makeFile(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    path: "src/lib/utils.ts",
    ext: ".ts",
    exports: ["add"],
    imports: [],
    loc: 20,
    isComponent: false,
    isTest: false,
    isStory: false,
    ...overrides,
  };
}

describe("ArchitectureDriftAgent", () => {
  it("detects circular dependency A→B→A", async () => {
    const agent = new ArchitectureDriftAgent();
    const files: FileEntry[] = [
      makeFile({ path: "src/lib/a.ts", imports: ["./b"], exports: ["fnA"] }),
      makeFile({ path: "src/lib/b.ts", imports: ["./a"], exports: ["fnB"] }),
    ];
    const result = await agent.execute({
      files,
      layerRules: {},
      namingRules: [],
    }, makeCtx());
    expect(result.output!.stats.circularDeps).toBeGreaterThan(0);
    expect(result.output!.violations.some((v) => v.type === "circular-dep")).toBe(true);
  });

  it("no circular dep when imports are one-directional", async () => {
    const agent = new ArchitectureDriftAgent();
    const files: FileEntry[] = [
      makeFile({ path: "src/lib/a.ts", imports: ["./b"], exports: ["fnA"] }),
      makeFile({ path: "src/lib/b.ts", imports: [], exports: ["fnB"] }),
    ];
    const result = await agent.execute({
      files,
      layerRules: {},
      namingRules: [],
    }, makeCtx());
    expect(result.output!.stats.circularDeps).toBe(0);
  });

  it("detects naming convention violation", async () => {
    const agent = new ArchitectureDriftAgent();
    const files: FileEntry[] = [
      makeFile({ path: "src/components/bad_name.tsx", ext: ".tsx", exports: ["Comp"] }),
    ];
    const result = await agent.execute({
      files,
      layerRules: {},
      namingRules: [{
        dirPrefix: "src/components",
        pattern: "^[A-Z][a-zA-Z0-9]+\\.tsx$",
        description: "PascalCase required",
      }],
    }, makeCtx());
    expect(result.output!.violations.some((v) => v.type === "naming")).toBe(true);
  });

  it("passes naming when file matches convention", async () => {
    const agent = new ArchitectureDriftAgent();
    const files: FileEntry[] = [
      makeFile({ path: "src/components/Button.tsx", ext: ".tsx", exports: ["Button"] }),
    ];
    const result = await agent.execute({
      files,
      layerRules: {},
      namingRules: [{
        dirPrefix: "src/components",
        pattern: "^[A-Z][a-zA-Z0-9]+\\.tsx$",
        description: "PascalCase required",
      }],
    }, makeCtx());
    expect(result.output!.violations.filter((v) => v.type === "naming")).toHaveLength(0);
  });

  it("detects missing barrel file", async () => {
    const agent = new ArchitectureDriftAgent();
    const files: FileEntry[] = [
      makeFile({ path: "src/lib/agents/CodeAgent.ts", exports: ["CodeAgent"] }),
    ];
    const result = await agent.execute({
      files,
      layerRules: {},
      namingRules: [],
      barrelDirs: ["src/lib/agents"],
    }, makeCtx());
    expect(result.output!.violations.some(
      (v) => v.type === "barrel-gap" && v.message.includes("Missing barrel"),
    )).toBe(true);
  });

  it("detects barrel gap (export not re-exported)", async () => {
    const agent = new ArchitectureDriftAgent();
    const files: FileEntry[] = [
      makeFile({ path: "src/lib/agents/index.ts", exports: ["AgentA"] }),
      makeFile({ path: "src/lib/agents/AgentB.ts", exports: ["AgentB"] }),
    ];
    const result = await agent.execute({
      files,
      layerRules: {},
      namingRules: [],
      barrelDirs: ["src/lib/agents"],
    }, makeCtx());
    expect(result.output!.violations.some(
      (v) => v.type === "barrel-gap" && v.message.includes("AgentB"),
    )).toBe(true);
  });

  it("detects layer boundary violation", async () => {
    const agent = new ArchitectureDriftAgent();
    const files: FileEntry[] = [
      makeFile({ path: "shared/types.ts", imports: ["../api/server"], exports: ["MyType"] }),
    ];
    const result = await agent.execute({
      files,
      layerRules: { "shared/": ["shared/"] },
      namingRules: [],
    }, makeCtx());
    expect(result.output!.violations.some((v) => v.type === "layer-breach")).toBe(true);
  });

  it("allows imports within same layer", async () => {
    const agent = new ArchitectureDriftAgent();
    const files: FileEntry[] = [
      makeFile({ path: "src/lib/a.ts", imports: ["./b"], exports: ["a"] }),
      makeFile({ path: "src/lib/b.ts", imports: [], exports: ["b"] }),
    ];
    const result = await agent.execute({
      files,
      layerRules: { "src/lib/": ["src/lib/", "shared/"] },
      namingRules: [],
    }, makeCtx());
    expect(result.output!.violations.filter((v) => v.type === "layer-breach")).toHaveLength(0);
  });

  it("detects orphan files (never imported)", async () => {
    const agent = new ArchitectureDriftAgent();
    const files: FileEntry[] = [
      makeFile({ path: "src/lib/used.ts", imports: [], exports: ["used"] }),
      makeFile({ path: "src/lib/orphan.ts", imports: [], exports: ["orphaned"] }),
      makeFile({ path: "src/lib/main.ts", imports: ["./used"], exports: ["main"] }),
    ];
    const result = await agent.execute({
      files,
      layerRules: {},
      namingRules: [],
    }, makeCtx());
    expect(result.output!.violations.some(
      (v) => v.type === "orphan" && v.files.includes("src/lib/orphan.ts"),
    )).toBe(true);
    // "used.ts" should NOT be flagged
    expect(result.output!.violations.some(
      (v) => v.type === "orphan" && v.files.includes("src/lib/used.ts"),
    )).toBe(false);
  });

  it("computes health score (100 with no violations)", async () => {
    const agent = new ArchitectureDriftAgent();
    const files: FileEntry[] = [
      makeFile({ path: "src/lib/a.ts", imports: [], exports: [] }),
      makeFile({ path: "src/lib/b.ts", imports: [], exports: [] }),
    ];
    const result = await agent.execute({
      files,
      layerRules: {},
      namingRules: [],
    }, makeCtx());
    expect(result.output!.healthScore).toBe(100);
  });

  it("builds import graph correctly", async () => {
    const agent = new ArchitectureDriftAgent();
    const files: FileEntry[] = [
      makeFile({ path: "src/lib/a.ts", imports: ["./b", "./c"], exports: ["a"] }),
      makeFile({ path: "src/lib/b.ts", imports: [], exports: ["b"] }),
      makeFile({ path: "src/lib/c.ts", imports: ["./b"], exports: ["c"] }),
    ];
    const result = await agent.execute({
      files,
      layerRules: {},
      namingRules: [],
    }, makeCtx());
    expect(result.output!.importGraph["src/lib/a.ts"]).toContain("src/lib/b.ts");
    expect(result.output!.importGraph["src/lib/a.ts"]).toContain("src/lib/c.ts");
  });

  it("skips test and story files for naming checks", async () => {
    const agent = new ArchitectureDriftAgent();
    const files: FileEntry[] = [
      makeFile({ path: "src/components/bad_name.test.ts", isTest: true, exports: ["test1"] }),
      makeFile({ path: "src/components/bad_name.stories.tsx", isStory: true, exports: ["Story1"] }),
    ];
    const result = await agent.execute({
      files,
      layerRules: {},
      namingRules: [{
        dirPrefix: "src/components",
        pattern: "^[A-Z][a-zA-Z0-9]+\\.tsx$",
        description: "PascalCase",
      }],
    }, makeCtx());
    expect(result.output!.violations.filter((v) => v.type === "naming")).toHaveLength(0);
  });
});
