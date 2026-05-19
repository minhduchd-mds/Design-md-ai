import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RepoMapAgent } from "../map/RepoMapAgent";
import type { AgentContextV6 } from "../BaseAgent";

const TEST_ROOT = join(tmpdir(), `desygn-repomap-${Date.now()}`);

function makeCtx(): AgentContextV6 {
  return {
    runId: "r1",
    projectId: "p1",
    costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

describe("RepoMapAgent", () => {
  beforeAll(async () => {
    await mkdir(join(TEST_ROOT, "src", "components"), { recursive: true });
    await mkdir(join(TEST_ROOT, "src", "lib"), { recursive: true });
    await mkdir(join(TEST_ROOT, "src", "__tests__"), { recursive: true });

    await writeFile(
      join(TEST_ROOT, "src", "components", "Button.tsx"),
      `export function Button({ label }: { label: string }) {\n  return <button>{label}</button>;\n}\n`,
    );
    await writeFile(
      join(TEST_ROOT, "src", "components", "Card.tsx"),
      `import { Button } from "./Button";\nexport function Card() { return <div><Button label="ok" /></div>; }\n`,
    );
    await writeFile(
      join(TEST_ROOT, "src", "lib", "utils.ts"),
      `export function add(a: number, b: number): number { return a + b; }\nexport const PI = 3.14;\n`,
    );
    await writeFile(
      join(TEST_ROOT, "src", "__tests__", "utils.test.ts"),
      `import { add } from "../lib/utils";\nexpect(add(1,2)).toBe(3);\n`,
    );
    await writeFile(
      join(TEST_ROOT, "src", "components", "Button.stories.tsx"),
      `export default { title: "Button" };\nexport const Primary = () => <Button label="Primary" />;\n`,
    );
    await writeFile(
      join(TEST_ROOT, "src", "theme.scss"),
      `.root { color: var(--dr-brand); }\n`,
    );
    await writeFile(
      join(TEST_ROOT, "package.json"),
      JSON.stringify({
        dependencies: { react: "^18.2.0" },
        devDependencies: { vitest: "^4.0.0" },
      }),
    );
  });

  afterAll(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  it("indexes source files from specified roots", async () => {
    const agent = new RepoMapAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"] }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.output!.files.length).toBeGreaterThanOrEqual(5);
    expect(result.output!.stats.totalFiles).toBeGreaterThanOrEqual(5);
  });

  it("detects components (PascalCase exports in .tsx)", async () => {
    const agent = new RepoMapAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"] }, makeCtx());
    const components = result.output!.components;
    expect(components.length).toBeGreaterThanOrEqual(2);
    expect(components.some((c) => c.exports.includes("Button"))).toBe(true);
    expect(components.some((c) => c.exports.includes("Card"))).toBe(true);
  });

  it("detects test files", async () => {
    const agent = new RepoMapAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"] }, makeCtx());
    expect(result.output!.tests.length).toBeGreaterThanOrEqual(1);
    expect(result.output!.tests[0].isTest).toBe(true);
  });

  it("extracts named exports", async () => {
    const agent = new RepoMapAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"] }, makeCtx());
    const utilsFile = result.output!.files.find((f) => f.path.includes("utils.ts"));
    expect(utilsFile).toBeDefined();
    expect(utilsFile!.exports).toContain("add");
    expect(utilsFile!.exports).toContain("PI");
  });

  it("extracts relative imports", async () => {
    const agent = new RepoMapAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"] }, makeCtx());
    const cardFile = result.output!.files.find((f) => f.path.includes("Card.tsx"));
    expect(cardFile).toBeDefined();
    expect(cardFile!.imports).toContain("./Button");
  });

  it("parses package.json dependencies", async () => {
    const agent = new RepoMapAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"] }, makeCtx());
    const deps = result.output!.dependencies;
    expect(deps.some((d) => d.name === "react" && !d.isDev)).toBe(true);
    expect(deps.some((d) => d.name === "vitest" && d.isDev)).toBe(true);
  });

  it("detects token files (CSS variable usage)", async () => {
    const agent = new RepoMapAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"] }, makeCtx());
    expect(result.output!.tokenFiles.length).toBeGreaterThanOrEqual(1);
    expect(result.output!.tokenFiles.some((f) => f.includes("theme.scss"))).toBe(true);
  });

  it("builds directory file counts", async () => {
    const agent = new RepoMapAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"] }, makeCtx());
    const dirs = result.output!.dirCounts;
    expect(dirs["src/components"]).toBeGreaterThanOrEqual(2);
  });

  it("skips non-existent roots", async () => {
    const agent = new RepoMapAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["nonexistent"] }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.output!.files).toHaveLength(0);
  });
});
