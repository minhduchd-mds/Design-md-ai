/**
 * End-to-end self-improvement loop smoke test.
 *
 * Exercises the full pipeline in a real temp git repo:
 *   1. SelfDiagnosticAgent → finds `: any` and TODO
 *   2. RefactorAgent → proposes any→unknown
 *   3. CodeFixAgent → generates unified diff
 *   4. fixApprovalReducer → simulate user approval
 *   5. git apply → applies diff in the repo (inline, not worktree)
 *
 * This proves the data flows through all 4 agent stages without error.
 * The worktree isolation is tested separately (WorktreeRunner unit tests).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SelfDiagnosticAgent } from "../self-improve/SelfDiagnosticAgent";
import { RefactorAgent } from "../self-improve/RefactorAgent";
import { CodeFixAgent } from "../fix/CodeFixAgent";
import {
  buildInitialState,
  fixApprovalReducer,
  getApprovedProposals,
  getApprovalCounts,
} from "../fix/useFixApproval";
import type { AgentContextV6 } from "../BaseAgent";

const TEST_ROOT = join(tmpdir(), `desygn-e2e-${Date.now()}`);
const SRC_DIR = join(TEST_ROOT, "src");

function makeCtx(): AgentContextV6 {
  return {
    runId: "e2e-1",
    projectId: "e2e-project",
    costBudgetUsd: 1,
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  };
}

describe("E2E self-improvement loop", () => {
  beforeAll(async () => {
    // Create a temp git repo with smelly source files
    await mkdir(SRC_DIR, { recursive: true });

    // File with `: any` usage
    await writeFile(
      join(SRC_DIR, "handler.ts"),
      [
        "// TODO: add proper types",
        "export function handle(req: any, res: any): any {",
        '  return res.json({ ok: true });',
        "}",
        "",
      ].join("\n"),
    );

    // File with eslint-disable and more `: any`
    await writeFile(
      join(SRC_DIR, "utils.ts"),
      [
        "// eslint-disable-next-line",
        "export function parse(input: any): any {",
        "  return JSON.parse(input);",
        "}",
        "",
      ].join("\n"),
    );

    // Initialise git repo so diff apply works
    execSync("git init", { cwd: TEST_ROOT, stdio: "ignore" });
    execSync("git add -A", { cwd: TEST_ROOT, stdio: "ignore" });
    execSync('git commit -m "initial"', { cwd: TEST_ROOT, stdio: "ignore" });
  });

  afterAll(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  it("full pipeline: diagnose → refactor → fix → approve → apply", async () => {
    const ctx = makeCtx();

    // ─── Step 1: SelfDiagnosticAgent ───
    const diagnostic = new SelfDiagnosticAgent(TEST_ROOT);
    const diagResult = await diagnostic.execute({ roots: ["src"] }, ctx);
    expect(diagResult.success).toBe(true);

    const anyIssues = diagResult.output!.candidates.filter((c) => c.type === "any");
    const todoIssues = diagResult.output!.candidates.filter((c) => c.type === "todo");
    expect(anyIssues.length).toBeGreaterThanOrEqual(2); // handler.ts + utils.ts
    expect(todoIssues.length).toBeGreaterThanOrEqual(1);

    // ─── Step 2: RefactorAgent ───
    const refactor = new RefactorAgent(TEST_ROOT);
    const refResult = await refactor.execute(
      { file: "src/handler.ts", kinds: ["any-to-unknown"] },
      ctx,
    );
    expect(refResult.success).toBe(true);
    expect(refResult.output!.proposals.length).toBeGreaterThanOrEqual(1);

    const proposals = refResult.output!.proposals;
    // All proposals should target any→unknown
    for (const p of proposals) {
      expect(p.kind).toBe("any-to-unknown");
      expect(p.after).toContain("unknown");
    }

    // ─── Step 3: CodeFixAgent ───
    const codeFix = new CodeFixAgent(TEST_ROOT);
    const fixResult = await codeFix.execute({ proposals }, ctx);
    expect(fixResult.success).toBe(true);
    expect(fixResult.output!.diff).toContain("diff --git");
    expect(fixResult.output!.files).toContain("src/handler.ts");
    expect(fixResult.output!.unappliable).toHaveLength(0);

    // ─── Step 4: Approval (pure reducer) ───
    const state = buildInitialState({
      proposals,
      diff: fixResult.output!.diff,
      files: fixResult.output!.files,
      unappliable: fixResult.output!.unappliable,
    });
    // Simulate user approving all
    const approved = fixApprovalReducer(state, { type: "approve-all" });
    const counts = getApprovalCounts(approved);
    expect(counts.approved).toBe(proposals.length);
    expect(counts.pending).toBe(0);

    const toApply = getApprovedProposals(approved);
    expect(toApply.length).toBe(proposals.length);

    // ─── Step 5: Apply diff (git apply in repo root) ───
    const diff = fixResult.output!.diff;
    try {
      execSync("git apply --whitespace=fix", {
        cwd: TEST_ROOT,
        input: diff,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      // If git apply fails, show the diff for debugging
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`git apply failed: ${message}\n\nDiff:\n${diff}`);
    }

    // ─── Verify the file was actually changed ───
    const updatedContent = await readFile(join(SRC_DIR, "handler.ts"), "utf8");
    expect(updatedContent).toContain("unknown");
    expect(updatedContent).not.toMatch(/: any/); // no remaining `: any`
  });

  it("handles mixed appliable and unappliable proposals", async () => {
    const ctx = makeCtx();

    // Reset the file back to original for this test
    await writeFile(
      join(SRC_DIR, "mixed.ts"),
      ["export function foo(x: any): any {", "  return x;", "}", ""].join("\n"),
    );
    execSync("git add src/mixed.ts", { cwd: TEST_ROOT, stdio: "ignore" });
    execSync('git commit -m "add mixed" -- src/mixed.ts', {
      cwd: TEST_ROOT,
      stdio: "ignore",
    });

    const refactor = new RefactorAgent(TEST_ROOT);
    const refResult = await refactor.execute(
      { file: "src/mixed.ts", kinds: ["any-to-unknown"] },
      ctx,
    );
    expect(refResult.success).toBe(true);

    // Add an intentionally stale proposal that will fail line-drift
    const goodProposals = refResult.output!.proposals;
    const badProposal = {
      id: "fake:stale",
      kind: "any-to-unknown" as const,
      file: "src/mixed.ts",
      line: 1,
      before: "this line does not exist in the file",
      after: "irrelevant",
      rationale: "stale proposal",
      risk: "low" as const,
    };

    const codeFix = new CodeFixAgent(TEST_ROOT);
    const fixResult = await codeFix.execute(
      { proposals: [...goodProposals, badProposal] },
      ctx,
    );
    expect(fixResult.success).toBe(true);
    expect(fixResult.output!.unappliable.length).toBe(1);
    expect(fixResult.output!.unappliable[0].id).toBe("fake:stale");
    expect(fixResult.output!.unappliable[0].reason).toContain("line drift");

    // Approval: only good proposals make it through
    const state = buildInitialState({
      proposals: goodProposals,
      diff: fixResult.output!.diff,
      files: fixResult.output!.files,
      unappliable: fixResult.output!.unappliable,
    });
    const decided = fixApprovalReducer(state, { type: "approve-all" });
    expect(getApprovalCounts(decided).approved).toBe(goodProposals.length);
  });
});
