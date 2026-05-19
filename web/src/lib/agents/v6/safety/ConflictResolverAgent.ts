/**
 * ConflictResolverAgent — detects and resolves merge conflicts in patch sets.
 *
 * When multiple agents (e.g. RefactorAgent + CodeFixAgent) produce patches
 * that touch overlapping files/regions, this agent:
 *   1. Detects which patches conflict
 *   2. Classifies conflict type (same-region, adjacent, rename vs edit)
 *   3. Attempts auto-resolution for trivial cases
 *   4. Flags complex conflicts for human review
 *
 * Deterministic v0 — no LLM. Uses line-range overlap detection.
 */

import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PatchHunk {
  /** File path the hunk applies to */
  file: string;
  /** Starting line (1-based) */
  startLine: number;
  /** Number of lines affected */
  lineCount: number;
  /** The diff content */
  content: string;
  /** Which agent produced this hunk */
  agentId: string;
  /** Priority: lower number = higher priority */
  priority: number;
}

export interface ConflictResolverInput {
  /** All patch hunks from parallel agent runs */
  hunks: PatchHunk[];
  /** Strategy for auto-resolution */
  strategy?: "priority" | "first-wins" | "reject-all";
}

export interface Conflict {
  /** Unique conflict ID */
  id: string;
  /** The two hunks that conflict */
  hunkA: PatchHunk;
  hunkB: PatchHunk;
  /** Conflict type */
  type: "same-region" | "adjacent" | "whole-file";
  /** Was it auto-resolved? */
  resolved: boolean;
  /** Which hunk won (if resolved) */
  winner?: PatchHunk;
  /** Resolution method */
  resolution?: "auto-priority" | "auto-first-wins" | "manual-required";
}

export interface ConflictResolverOutput {
  /** Detected conflicts */
  conflicts: Conflict[];
  /** Hunks that are safe to apply (no conflicts) */
  safeHunks: PatchHunk[];
  /** Hunks chosen after conflict resolution */
  resolvedHunks: PatchHunk[];
  /** Hunks that need human review */
  manualReview: Conflict[];
  /** Stats */
  stats: {
    totalHunks: number;
    conflictCount: number;
    autoResolved: number;
    manualRequired: number;
    filesAffected: number;
  };
}

export class ConflictResolverAgent extends BaseAgentV6<ConflictResolverInput, ConflictResolverOutput> {
  readonly id = "safety.conflict-resolver";
  readonly name = "Conflict Resolver";
  readonly fleet: FleetName = "safety";
  readonly role = "analyzer" as const;
  readonly description = "Detects and resolves merge conflicts between parallel agent patches";

  protected async run(
    input: ConflictResolverInput,
    ctx: AgentContextV6,
  ): Promise<{ output: ConflictResolverOutput; evidence?: string[] }> {
    const { hunks, strategy = "priority" } = input;

    // Group hunks by file
    const byFile = new Map<string, PatchHunk[]>();
    for (const h of hunks) {
      const existing = byFile.get(h.file) ?? [];
      existing.push(h);
      byFile.set(h.file, existing);
    }

    const conflicts: Conflict[] = [];
    const conflictingHunks = new Set<PatchHunk>();
    let conflictSeq = 0;

    // Detect conflicts: hunks in the same file with overlapping line ranges
    for (const [, fileHunks] of byFile) {
      // Sort by start line
      const sorted = [...fileHunks].sort((a, b) => a.startLine - b.startLine);

      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const a = sorted[i];
          const b = sorted[j];

          if (a.agentId === b.agentId) continue; // Same agent can't conflict with itself

          const conflictType = detectConflictType(a, b);
          if (conflictType) {
            conflicts.push({
              id: `conflict-${conflictSeq++}`,
              hunkA: a,
              hunkB: b,
              type: conflictType,
              resolved: false,
            });
            conflictingHunks.add(a);
            conflictingHunks.add(b);
          }
        }
      }
    }

    // Resolve conflicts
    for (const conflict of conflicts) {
      resolveConflict(conflict, strategy);
    }

    // Build safe hunks (those not involved in any conflict)
    const safeHunks = hunks.filter((h) => !conflictingHunks.has(h));

    // Build resolved hunks (safe + winners from resolved conflicts)
    const winners = new Set<PatchHunk>();
    const manualReview: Conflict[] = [];

    for (const c of conflicts) {
      if (c.resolved && c.winner) {
        winners.add(c.winner);
      } else {
        manualReview.push(c);
      }
    }

    const resolvedHunks = [...safeHunks, ...winners];

    // Deduplicate resolved hunks
    const seen = new Set<string>();
    const dedupedResolved = resolvedHunks.filter((h) => {
      const key = `${h.file}:${h.startLine}:${h.agentId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const filesAffected = new Set(hunks.map((h) => h.file)).size;

    ctx.logger.info(
      `[conflict-resolver] ${conflicts.length} conflicts found, ${conflicts.filter((c) => c.resolved).length} auto-resolved, ${manualReview.length} manual`,
    );

    return {
      output: {
        conflicts,
        safeHunks,
        resolvedHunks: dedupedResolved,
        manualReview,
        stats: {
          totalHunks: hunks.length,
          conflictCount: conflicts.length,
          autoResolved: conflicts.filter((c) => c.resolved).length,
          manualRequired: manualReview.length,
          filesAffected,
        },
      },
      evidence: [
        `conflicts=${conflicts.length}`,
        `autoResolved=${conflicts.filter((c) => c.resolved).length}`,
        `manualRequired=${manualReview.length}`,
      ],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function detectConflictType(a: PatchHunk, b: PatchHunk): Conflict["type"] | null {
  if (a.file !== b.file) return null;

  const aEnd = a.startLine + a.lineCount - 1;
  const bEnd = b.startLine + b.lineCount - 1;

  // Whole-file conflict: both hunks start at line 1 and span large portions
  if (a.startLine === 1 && b.startLine === 1 && a.lineCount > 50 && b.lineCount > 50) {
    return "whole-file";
  }

  // Same-region: ranges overlap
  if (a.startLine <= bEnd && b.startLine <= aEnd) {
    return "same-region";
  }

  // Adjacent: ranges are within 3 lines of each other (merge risk)
  const gap = Math.max(b.startLine - aEnd, a.startLine - bEnd);
  if (gap > 0 && gap <= 3) {
    return "adjacent";
  }

  return null;
}

function resolveConflict(
  conflict: Conflict,
  strategy: ConflictResolverInput["strategy"],
): void {
  // Adjacent conflicts can always be auto-resolved (no actual overlap)
  if (conflict.type === "adjacent") {
    conflict.resolved = true;
    conflict.winner = conflict.hunkA.priority <= conflict.hunkB.priority
      ? conflict.hunkA
      : conflict.hunkB;
    conflict.resolution = "auto-priority";
    return;
  }

  // Whole-file conflicts always need manual review
  if (conflict.type === "whole-file") {
    conflict.resolved = false;
    conflict.resolution = "manual-required";
    return;
  }

  // Same-region: depends on strategy
  switch (strategy) {
    case "priority": {
      conflict.resolved = true;
      conflict.winner = conflict.hunkA.priority <= conflict.hunkB.priority
        ? conflict.hunkA
        : conflict.hunkB;
      conflict.resolution = "auto-priority";
      break;
    }
    case "first-wins": {
      conflict.resolved = true;
      conflict.winner = conflict.hunkA;
      conflict.resolution = "auto-first-wins";
      break;
    }
    case "reject-all": {
      conflict.resolved = false;
      conflict.resolution = "manual-required";
      break;
    }
  }
}
