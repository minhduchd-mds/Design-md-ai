/**
 * useFixApproval — React hook + pure helpers for proposal approval state.
 *
 * Exports:
 *   - useFixApproval()         — React hook (useReducer-based)
 *   - fixApprovalReducer()     — pure reducer (testable without React)
 *   - buildInitialState()      — initial state builder
 *   - getApprovalCounts()      — derived counts from state
 *   - getApprovedProposals()   — filter approved proposals
 */

import { useCallback, useMemo, useReducer } from "react";
import type { RefactorProposal } from "../self-improve/RefactorAgent";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ProposalDecision = "pending" | "approved" | "rejected";

export interface ProposalEntry {
  proposal: RefactorProposal;
  decision: ProposalDecision;
}

export interface FixApprovalState {
  entries: ProposalEntry[];
  /** Unified diff produced by CodeFixAgent (display only) */
  diff: string;
  /** Files listed in the diff */
  files: string[];
  /** Proposals CodeFixAgent could not turn into a diff */
  unappliable: { id: string; reason: string }[];
}

export type FixApprovalAction =
  | { type: "decide"; id: string; decision: ProposalDecision }
  | { type: "approve-all" }
  | { type: "reject-all" }
  | { type: "reset" };

// ─────────────────────────────────────────────────────────────────────────────
// Pure reducer (exported for direct testing)
// ─────────────────────────────────────────────────────────────────────────────

export function fixApprovalReducer(
  state: FixApprovalState,
  action: FixApprovalAction,
): FixApprovalState {
  switch (action.type) {
    case "decide":
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.proposal.id === action.id ? { ...e, decision: action.decision } : e,
        ),
      };
    case "approve-all":
      return {
        ...state,
        entries: state.entries.map((e) => ({ ...e, decision: "approved" as const })),
      };
    case "reject-all":
      return {
        ...state,
        entries: state.entries.map((e) => ({ ...e, decision: "rejected" as const })),
      };
    case "reset":
      return {
        ...state,
        entries: state.entries.map((e) => ({ ...e, decision: "pending" as const })),
      };
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// State builder + derived helpers (also testable without React)
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildInitialStateOptions {
  proposals: RefactorProposal[];
  diff: string;
  files: string[];
  unappliable?: { id: string; reason: string }[];
}

export function buildInitialState(options: BuildInitialStateOptions): FixApprovalState {
  return {
    entries: options.proposals.map((p) => ({ proposal: p, decision: "pending" as const })),
    diff: options.diff,
    files: options.files,
    unappliable: options.unappliable ?? [],
  };
}

export function getApprovalCounts(state: FixApprovalState): {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
} {
  const c = { pending: 0, approved: 0, rejected: 0, total: state.entries.length };
  for (const e of state.entries) {
    c[e.decision]++;
  }
  return c;
}

export function getApprovedProposals(state: FixApprovalState): RefactorProposal[] {
  return state.entries.filter((e) => e.decision === "approved").map((e) => e.proposal);
}

// ─────────────────────────────────────────────────────────────────────────────
// React hook
// ─────────────────────────────────────────────────────────────────────────────

export interface UseFixApprovalOptions {
  proposals: RefactorProposal[];
  diff: string;
  files: string[];
  unappliable?: { id: string; reason: string }[];
}

export interface UseFixApprovalReturn {
  entries: ProposalEntry[];
  diff: string;
  files: string[];
  unappliable: { id: string; reason: string }[];
  counts: { pending: number; approved: number; rejected: number; total: number };
  allDecided: boolean;
  approvedProposals: RefactorProposal[];
  decide: (id: string, decision: ProposalDecision) => void;
  approveAll: () => void;
  rejectAll: () => void;
  reset: () => void;
}

export function useFixApproval(options: UseFixApprovalOptions): UseFixApprovalReturn {
  const initialState = buildInitialState(options);
  const [state, dispatch] = useReducer(fixApprovalReducer, initialState);

  const decide = useCallback(
    (id: string, decision: ProposalDecision) => dispatch({ type: "decide", id, decision }),
    [],
  );
  const approveAll = useCallback(() => dispatch({ type: "approve-all" }), []);
  const rejectAll = useCallback(() => dispatch({ type: "reject-all" }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  const counts = useMemo(() => getApprovalCounts(state), [state]);
  const allDecided = counts.pending === 0;
  const approvedProposals = useMemo(() => getApprovedProposals(state), [state]);

  return {
    entries: state.entries,
    diff: state.diff,
    files: state.files,
    unappliable: state.unappliable,
    counts,
    allDecided,
    approvedProposals,
    decide,
    approveAll,
    rejectAll,
    reset,
  };
}
