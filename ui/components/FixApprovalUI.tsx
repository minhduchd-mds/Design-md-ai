/**
 * FixApprovalUI — Diff preview + approve/reject for Agent Fleet v6.
 *
 * This is the "user-as-conductor" surface:
 *   1. SelfDiagnosticAgent finds issues
 *   2. RefactorAgent proposes changes
 *   3. CodeFixAgent produces unified diff
 *   4. **This UI** shows the diff + per-proposal approve/reject
 *   5. On confirm → DiffApplierAgent applies in worktree
 *
 * Design: dark-theme, CSS Modules, gap-based layout.
 */

import { useState, useCallback } from "react";
import type { RefactorProposal } from "../../web/src/lib/agents/v6/self-improve/RefactorAgent";
import type { ProposalDecision, ProposalEntry } from "../../web/src/lib/agents/v6/fix/useFixApproval";
import styles from "./FixApprovalUI.module.scss";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface FixApprovalUIProps {
  /** Proposal entries with current decision state */
  entries: ProposalEntry[];
  /** Full unified diff from CodeFixAgent */
  diff: string;
  /** Files touched by the diff */
  files: string[];
  /** Proposals that could not be applied */
  unappliable: { id: string; reason: string }[];
  /** Decision counts */
  counts: { pending: number; approved: number; rejected: number; total: number };
  /** Approved proposals ready for DiffApplierAgent */
  approvedProposals: RefactorProposal[];
  /** Set a single proposal decision */
  onDecide: (id: string, decision: ProposalDecision) => void;
  /** Approve all at once */
  onApproveAll: () => void;
  /** Reject all at once */
  onRejectAll: () => void;
  /** Reset decisions */
  onReset: () => void;
  /** Confirm: apply approved proposals via DiffApplierAgent */
  onApply: (approved: RefactorProposal[]) => void;
  /** Whether the apply action is in progress */
  applying?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function FixApprovalUI({
  entries,
  diff,
  files,
  unappliable,
  counts,
  approvedProposals,
  onDecide,
  onApproveAll,
  onRejectAll,
  onReset,
  onApply,
  applying = false,
}: FixApprovalUIProps) {
  const [showDiff, setShowDiff] = useState(false);

  const handleApply = useCallback(() => {
    if (approvedProposals.length > 0) {
      onApply(approvedProposals);
    }
  }, [approvedProposals, onApply]);

  if (entries.length === 0 && unappliable.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>No proposals to review.</div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* Header + counts */}
      <div className={styles.header}>
        <span className={styles.title}>Fix Proposals</span>
        <div className={styles.counts}>
          {counts.pending > 0 && (
            <span className={`${styles.countBadge} ${styles.countPending}`}>
              {counts.pending} pending
            </span>
          )}
          {counts.approved > 0 && (
            <span className={`${styles.countBadge} ${styles.countApproved}`}>
              {counts.approved} approved
            </span>
          )}
          {counts.rejected > 0 && (
            <span className={`${styles.countBadge} ${styles.countRejected}`}>
              {counts.rejected} rejected
            </span>
          )}
        </div>
      </div>

      {/* Files affected */}
      {files.length > 0 && (
        <div className={styles.filesList}>
          {files.map((f) => (
            <span key={f} className={styles.fileTag}>{f}</span>
          ))}
        </div>
      )}

      {/* Bulk actions */}
      <div className={styles.bulkActions}>
        <button
          className={styles.bulkBtn}
          onClick={onApproveAll}
          disabled={applying || counts.pending === 0}
        >
          Approve All
        </button>
        <button
          className={styles.bulkBtn}
          onClick={onRejectAll}
          disabled={applying || counts.pending === 0}
        >
          Reject All
        </button>
        <button
          className={styles.bulkBtn}
          onClick={onReset}
          disabled={applying || counts.pending === counts.total}
        >
          Reset
        </button>
      </div>

      {/* Diff toggle */}
      {diff && (
        <div className={styles.diffViewer}>
          <button
            className={styles.diffToggle}
            onClick={() => setShowDiff(!showDiff)}
          >
            {showDiff ? "▼" : "▶"} {showDiff ? "Hide" : "Show"} unified diff
          </button>
          {showDiff && <DiffBlock diff={diff} />}
        </div>
      )}

      {/* Proposal cards */}
      <div className={styles.proposals}>
        {entries.map((entry) => (
          <ProposalCard
            key={entry.proposal.id}
            entry={entry}
            onDecide={onDecide}
            disabled={applying}
          />
        ))}
      </div>

      {/* Unappliable warnings */}
      {unappliable.length > 0 && (
        <div className={styles.unappliable}>
          <div className={styles.unappliableHeader}>
            {unappliable.length} proposal{unappliable.length > 1 ? "s" : ""} could not be applied
          </div>
          {unappliable.map((u) => (
            <div key={u.id} className={styles.unappliableItem}>
              <span className={styles.unappliableId}>{u.id}</span>
              <span>{u.reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* Apply bar */}
      {counts.approved > 0 && (
        <div className={styles.applyBar}>
          <span className={styles.applyInfo}>
            <span className={styles.applyCount}>{counts.approved}</span>{" "}
            proposal{counts.approved > 1 ? "s" : ""} approved
          </span>
          <button
            className={styles.applyBtn}
            onClick={handleApply}
            disabled={applying || counts.approved === 0}
          >
            {applying ? "Applying..." : "Apply to Worktree"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProposalCard sub-component
// ─────────────────────────────────────────────────────────────────────────────

interface ProposalCardProps {
  entry: ProposalEntry;
  onDecide: (id: string, decision: ProposalDecision) => void;
  disabled: boolean;
}

function ProposalCard({ entry, onDecide, disabled }: ProposalCardProps) {
  const { proposal, decision } = entry;

  const riskClass =
    proposal.risk === "high"
      ? styles.riskHigh
      : proposal.risk === "medium"
        ? styles.riskMedium
        : styles.riskLow;

  const cardClass = [
    styles.proposal,
    decision === "approved" && styles.proposalApproved,
    decision === "rejected" && styles.proposalRejected,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass} data-testid={`proposal-${proposal.id}`}>
      {/* Meta row */}
      <div className={styles.proposalMeta}>
        <span className={styles.kindBadge}>{formatKind(proposal.kind)}</span>
        <span className={riskClass}>
          {proposal.risk} risk
        </span>
        <span className={styles.fileLoc}>
          {proposal.file}:{proposal.line}
        </span>
      </div>

      {/* Rationale */}
      <div className={styles.rationale}>{proposal.rationale}</div>

      {/* Code diff */}
      <div className={styles.codeDiff}>
        <div className={styles.codeBefore}>- {proposal.before}</div>
        <div className={styles.codeAfter}>+ {proposal.after}</div>
      </div>

      {/* Decision buttons or label */}
      <div className={styles.actions}>
        {decision === "pending" ? (
          <>
            <button
              className={styles.approveBtn}
              onClick={() => onDecide(proposal.id, "approved")}
              disabled={disabled}
            >
              Approve
            </button>
            <button
              className={styles.rejectBtn}
              onClick={() => onDecide(proposal.id, "rejected")}
              disabled={disabled}
            >
              Reject
            </button>
          </>
        ) : (
          <>
            <span
              className={`${styles.decidedLabel} ${
                decision === "approved" ? styles.decidedApproved : styles.decidedRejected
              }`}
            >
              {decision === "approved" ? "✓ Approved" : "✗ Rejected"}
            </span>
            <button
              className={styles.undoBtn}
              onClick={() => onDecide(proposal.id, "pending")}
              disabled={disabled}
            >
              Undo
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DiffBlock sub-component
// ─────────────────────────────────────────────────────────────────────────────

function DiffBlock({ diff }: { diff: string }) {
  const lines = diff.split("\n");
  return (
    <pre className={styles.diffPre}>
      {lines.map((line, i) => {
        const cls = getDiffLineClass(line);
        return (
          <span key={i} className={cls}>
            {line}
          </span>
        );
      })}
    </pre>
  );
}

function getDiffLineClass(line: string): string {
  if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("diff --git")) {
    return styles.diffLineMeta;
  }
  if (line.startsWith("@@")) return styles.diffLineHunk;
  if (line.startsWith("-")) return styles.diffLineRemoved;
  if (line.startsWith("+")) return styles.diffLineAdded;
  return styles.diffLineContext;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatKind(kind: string): string {
  return kind
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
