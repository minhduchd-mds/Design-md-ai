/**
 * useFixApproval — unit tests for the approval state reducer.
 *
 * Tests the exported reducer and helpers directly (no React rendering needed).
 */
import { describe, it, expect } from "vitest";
import {
  fixApprovalReducer,
  buildInitialState,
  getApprovalCounts,
  getApprovedProposals,
} from "../fix/useFixApproval";
import type { RefactorProposal } from "../self-improve/RefactorAgent";

function makeProposal(id: string, risk: "low" | "medium" | "high" = "low"): RefactorProposal {
  return {
    id,
    kind: "any-to-unknown",
    file: "src/util.ts",
    line: 10,
    before: "x: any",
    after: "x: unknown",
    rationale: `fix ${id}`,
    risk,
  };
}

const SAMPLE_DIFF = "diff --git a/src/util.ts b/src/util.ts\n-x: any\n+x: unknown\n";

describe("fixApprovalReducer", () => {
  it("initialises all proposals as pending", () => {
    const state = buildInitialState({
      proposals: [makeProposal("p1"), makeProposal("p2")],
      diff: SAMPLE_DIFF,
      files: ["src/util.ts"],
    });
    expect(state.entries).toHaveLength(2);
    expect(state.entries.every((e) => e.decision === "pending")).toBe(true);
    const counts = getApprovalCounts(state);
    expect(counts).toEqual({ pending: 2, approved: 0, rejected: 0, total: 2 });
    expect(getApprovedProposals(state)).toHaveLength(0);
  });

  it("decide action changes a single proposal", () => {
    const state = buildInitialState({
      proposals: [makeProposal("p1"), makeProposal("p2")],
      diff: SAMPLE_DIFF,
      files: ["src/util.ts"],
    });
    const next = fixApprovalReducer(state, { type: "decide", id: "p1", decision: "approved" });
    expect(next.entries[0].decision).toBe("approved");
    expect(next.entries[1].decision).toBe("pending");
    expect(getApprovalCounts(next).approved).toBe(1);
    expect(getApprovedProposals(next)).toHaveLength(1);
    expect(getApprovedProposals(next)[0].id).toBe("p1");
  });

  it("approve-all approves every entry", () => {
    const state = buildInitialState({
      proposals: [makeProposal("a"), makeProposal("b"), makeProposal("c")],
      diff: "",
      files: [],
    });
    const next = fixApprovalReducer(state, { type: "approve-all" });
    const counts = getApprovalCounts(next);
    expect(counts).toEqual({ pending: 0, approved: 3, rejected: 0, total: 3 });
    expect(getApprovedProposals(next)).toHaveLength(3);
  });

  it("reject-all rejects every entry", () => {
    const state = buildInitialState({
      proposals: [makeProposal("a"), makeProposal("b")],
      diff: "",
      files: [],
    });
    const next = fixApprovalReducer(state, { type: "reject-all" });
    const counts = getApprovalCounts(next);
    expect(counts.rejected).toBe(2);
    expect(getApprovedProposals(next)).toHaveLength(0);
  });

  it("reset returns everything to pending", () => {
    const state = buildInitialState({
      proposals: [makeProposal("a"), makeProposal("b")],
      diff: "",
      files: [],
    });
    const approved = fixApprovalReducer(state, { type: "approve-all" });
    expect(getApprovalCounts(approved).approved).toBe(2);
    const reset = fixApprovalReducer(approved, { type: "reset" });
    expect(getApprovalCounts(reset).pending).toBe(2);
    expect(getApprovalCounts(reset).approved).toBe(0);
  });

  it("tracks unappliable from options", () => {
    const state = buildInitialState({
      proposals: [makeProposal("p1")],
      diff: SAMPLE_DIFF,
      files: ["src/util.ts"],
      unappliable: [{ id: "p2", reason: "line drift" }],
    });
    expect(state.unappliable).toHaveLength(1);
    expect(state.unappliable[0].reason).toContain("line drift");
  });

  it("mixed decisions: approve one, reject another", () => {
    const state = buildInitialState({
      proposals: [makeProposal("a"), makeProposal("b"), makeProposal("c")],
      diff: "",
      files: [],
    });
    const s1 = fixApprovalReducer(state, { type: "decide", id: "a", decision: "approved" });
    const s2 = fixApprovalReducer(s1, { type: "decide", id: "b", decision: "rejected" });
    const counts = getApprovalCounts(s2);
    expect(counts).toEqual({ pending: 1, approved: 1, rejected: 1, total: 3 });
    expect(getApprovedProposals(s2)).toHaveLength(1);
    expect(getApprovedProposals(s2)[0].id).toBe("a");
  });

  it("can undo a decision by setting back to pending", () => {
    const state = buildInitialState({
      proposals: [makeProposal("a")],
      diff: "",
      files: [],
    });
    const approved = fixApprovalReducer(state, { type: "decide", id: "a", decision: "approved" });
    expect(getApprovalCounts(approved).approved).toBe(1);
    const undone = fixApprovalReducer(approved, { type: "decide", id: "a", decision: "pending" });
    expect(getApprovalCounts(undone).pending).toBe(1);
    expect(getApprovalCounts(undone).approved).toBe(0);
  });

  it("preserves diff and files from options", () => {
    const state = buildInitialState({
      proposals: [],
      diff: "diff --git a/x b/x",
      files: ["x.ts", "y.ts"],
    });
    expect(state.diff).toBe("diff --git a/x b/x");
    expect(state.files).toEqual(["x.ts", "y.ts"]);
  });

  it("unknown action returns state unchanged", () => {
    const state = buildInitialState({
      proposals: [makeProposal("a")],
      diff: "",
      files: [],
    });
    // @ts-expect-error — testing invalid action
    const same = fixApprovalReducer(state, { type: "nonexistent" });
    expect(same).toBe(state);
  });
});
