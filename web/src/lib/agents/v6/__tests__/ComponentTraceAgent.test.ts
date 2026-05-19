import { describe, it, expect, vi } from "vitest";
import { ComponentTraceAgent } from "../map/ComponentTraceAgent";
import type { FileEntry } from "../map/RepoMapAgent";
import type { AgentContextV6 } from "../BaseAgent";

function makeCtx(): AgentContextV6 {
  return {
    runId: "r1", projectId: "p1", costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

const MOCK_FILES: FileEntry[] = [
  { path: "src/components/Button.tsx", ext: ".tsx", exports: ["Button"], imports: [], loc: 20, isComponent: true, isTest: false, isStory: false },
  { path: "src/components/NavBar.tsx", ext: ".tsx", exports: ["NavBar", "NavItem"], imports: ["./Button"], loc: 45, isComponent: true, isTest: false, isStory: false },
  { path: "src/components/Card.tsx", ext: ".tsx", exports: ["Card"], imports: [], loc: 30, isComponent: true, isTest: false, isStory: false },
  { path: "src/lib/utils.ts", ext: ".ts", exports: ["add", "PI"], imports: [], loc: 10, isComponent: false, isTest: false, isStory: false },
  { path: "src/__tests__/Button.test.ts", ext: ".ts", exports: [], imports: ["../components/Button"], loc: 15, isComponent: false, isTest: true, isStory: false },
  { path: "src/components/Button.stories.tsx", ext: ".tsx", exports: ["Primary"], imports: ["./Button"], loc: 10, isComponent: false, isTest: false, isStory: true },
];

describe("ComponentTraceAgent", () => {
  it("exact match: Figma name matches export", async () => {
    const agent = new ComponentTraceAgent();
    const result = await agent.execute(
      { figmaName: "Button", repoFiles: MOCK_FILES },
      makeCtx(),
    );
    expect(result.output!.found).toBe(true);
    expect(result.output!.confidence).toBe(1.0);
    expect(result.output!.codeFile).toBe("src/components/Button.tsx");
    expect(result.output!.exportName).toBe("Button");
    expect(result.output!.matchStrategy).toBe("exact");
  });

  it("handles Figma variant separator: Button/Primary → Button", async () => {
    const agent = new ComponentTraceAgent();
    const result = await agent.execute(
      { figmaName: "Button/Primary", repoFiles: MOCK_FILES },
      makeCtx(),
    );
    expect(result.output!.found).toBe(true);
    expect(result.output!.exportName).toBe("Button");
  });

  it("handles kebab-case: nav-bar → NavBar", async () => {
    const agent = new ComponentTraceAgent();
    const result = await agent.execute(
      { figmaName: "nav-bar", repoFiles: MOCK_FILES },
      makeCtx(),
    );
    expect(result.output!.found).toBe(true);
    expect(result.output!.codeFile).toBe("src/components/NavBar.tsx");
  });

  it("finds associated test file", async () => {
    const agent = new ComponentTraceAgent();
    const result = await agent.execute(
      { figmaName: "Button", repoFiles: MOCK_FILES },
      makeCtx(),
    );
    expect(result.output!.testFile).toContain("Button.test");
  });

  it("finds associated story file", async () => {
    const agent = new ComponentTraceAgent();
    const result = await agent.execute(
      { figmaName: "Button", repoFiles: MOCK_FILES },
      makeCtx(),
    );
    expect(result.output!.storyFile).toContain("Button.stories");
  });

  it("returns not found for unknown component", async () => {
    const agent = new ComponentTraceAgent();
    const result = await agent.execute(
      { figmaName: "NonExistentWidget", repoFiles: MOCK_FILES },
      makeCtx(),
    );
    expect(result.output!.found).toBe(false);
    expect(result.output!.matchStrategy).toBe("none");
    expect(result.output!.confidence).toBe(0);
  });

  it("limits candidates to top 5", async () => {
    const agent = new ComponentTraceAgent();
    const result = await agent.execute(
      { figmaName: "Card", repoFiles: MOCK_FILES },
      makeCtx(),
    );
    expect(result.output!.candidates.length).toBeLessThanOrEqual(5);
  });
});
