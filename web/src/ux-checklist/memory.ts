/**
 * Cross-Project Memory Persistence for the Agentic UI/UX Auditor.
 *
 * Allows the AI auditor to learn across multiple projects, persist knowledge,
 * and provide increasingly relevant recommendations over time.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A single decision made by a team member on a criterion. */
export interface TeamDecision {
  criterionId: string;
  decision: "accept" | "reject" | "defer";
  reason: string;
  decidedBy: string;
  timestamp: number;
}

/** Feedback entry capturing agreement/disagreement with an audit finding. */
export interface FeedbackEntry {
  criterionId: string;
  type: "agree" | "disagree" | "irrelevant";
  context: string;
  timestamp: number;
}

/** A full memory entry for a single project audit. */
export interface ProjectMemoryEntry {
  id: string;
  projectId: string;
  projectName: string;
  timestamp: number;
  auditScore: number;
  /** Learned weights for each criterion (criterionId -> weight). */
  criteriaWeights: Map<string, number>;
  teamDecisions: TeamDecision[];
  feedbackLog: FeedbackEntry[];
}

/** A pattern detected across multiple projects. */
export interface LearningPattern {
  id: string;
  type:
    | "recurring-failure"
    | "team-preference"
    | "industry-standard"
    | "project-specific";
  criterionIds: string[];
  confidence: number;
  description: string;
  suggestedAction: string;
  occurrences: number;
}

/** Full export snapshot of all accumulated knowledge. */
export interface KnowledgeSnapshot {
  version: number;
  exportedAt: number;
  projects: ProjectMemoryEntry[];
  patterns: LearningPattern[];
  globalWeights: Record<string, number>;
}

/** Minimal audit criterion reference used by the suggestion system. */
export interface AuditCriterion {
  id: string;
  name: string;
  weight: number;
  category: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = "designready.memory.";
const KNOWLEDGE_VERSION = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Serialization Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Serialized form of ProjectMemoryEntry for JSON storage. */
interface SerializedProjectMemoryEntry
  extends Omit<ProjectMemoryEntry, "criteriaWeights"> {
  criteriaWeights: Record<string, number>;
}

function serializeEntry(entry: ProjectMemoryEntry): SerializedProjectMemoryEntry {
  return {
    ...entry,
    criteriaWeights: Object.fromEntries(entry.criteriaWeights),
  };
}

function deserializeEntry(raw: SerializedProjectMemoryEntry): ProjectMemoryEntry {
  return {
    ...raw,
    criteriaWeights: new Map(Object.entries(raw.criteriaWeights)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ProjectMemory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manages per-project audit history.
 * Stores a rolling window of entries and exposes helpers for weight evolution.
 */
export class ProjectMemory {
  private entries: ProjectMemoryEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 50) {
    this.maxEntries = maxEntries;
  }

  /** Add a new audit entry for a project. */
  addEntry(entry: ProjectMemoryEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  /** Retrieve all entries for a given project. */
  getEntriesForProject(projectId: string): ProjectMemoryEntry[] {
    return this.entries.filter((e) => e.projectId === projectId);
  }

  /** Get the latest entry for a project. */
  getLatest(projectId: string): ProjectMemoryEntry | null {
    const projectEntries = this.getEntriesForProject(projectId);
    if (projectEntries.length === 0) return null;
    return projectEntries[projectEntries.length - 1];
  }

  /** Return all stored entries. */
  getAllEntries(): ProjectMemoryEntry[] {
    return [...this.entries];
  }

  /** Compute weight evolution for a criterion across a project's history. */
  getWeightHistory(projectId: string, criterionId: string): number[] {
    return this.getEntriesForProject(projectId)
      .map((e) => e.criteriaWeights.get(criterionId) ?? 0)
      .filter((w) => w > 0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CrossProjectLearning
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregates learning across multiple projects to surface patterns and
 * recommend criteria based on historical performance.
 */
export class CrossProjectLearning {
  /**
   * Compute a weighted average of criterion weights across all projects.
   * More recent projects have higher influence (exponential decay).
   */
  aggregateWeights(projects: ProjectMemoryEntry[]): Map<string, number> {
    if (projects.length === 0) return new Map();

    const now = Date.now();
    const decayFactor = 1 / (30 * 24 * 60 * 60 * 1000); // 30-day half-life

    const weightSums = new Map<string, number>();
    const weightCounts = new Map<string, number>();

    for (const project of projects) {
      const age = now - project.timestamp;
      const recency = Math.exp(-age * decayFactor);

      for (const [criterionId, weight] of project.criteriaWeights) {
        const current = weightSums.get(criterionId) ?? 0;
        const count = weightCounts.get(criterionId) ?? 0;
        weightSums.set(criterionId, current + weight * recency);
        weightCounts.set(criterionId, count + recency);
      }
    }

    const result = new Map<string, number>();
    for (const [criterionId, sum] of weightSums) {
      const count = weightCounts.get(criterionId) ?? 1;
      result.set(criterionId, sum / count);
    }

    return result;
  }

  /**
   * Detect recurring patterns (failures, preferences, standards) across projects.
   */
  detectPatterns(projects: ProjectMemoryEntry[]): LearningPattern[] {
    const patterns: LearningPattern[] = [];

    // Detect recurring failures: criteria that are consistently rejected
    const rejectionCounts = new Map<string, number>();
    const totalProjects = projects.length;

    for (const project of projects) {
      for (const decision of project.teamDecisions) {
        if (decision.decision === "reject") {
          rejectionCounts.set(
            decision.criterionId,
            (rejectionCounts.get(decision.criterionId) ?? 0) + 1
          );
        }
      }
    }

    for (const [criterionId, count] of rejectionCounts) {
      const frequency = count / Math.max(totalProjects, 1);
      if (frequency >= 0.5 && count >= 3) {
        patterns.push({
          id: `pattern-recurring-failure-${criterionId}`,
          type: "recurring-failure",
          criterionIds: [criterionId],
          confidence: Math.min(frequency, 0.95),
          description: `Criterion "${criterionId}" is rejected in ${Math.round(frequency * 100)}% of projects`,
          suggestedAction: "Consider lowering weight or removing from default checklist",
          occurrences: count,
        });
      }
    }

    // Detect team preferences: criteria consistently accepted
    const acceptCounts = new Map<string, number>();
    for (const project of projects) {
      for (const decision of project.teamDecisions) {
        if (decision.decision === "accept") {
          acceptCounts.set(
            decision.criterionId,
            (acceptCounts.get(decision.criterionId) ?? 0) + 1
          );
        }
      }
    }

    for (const [criterionId, count] of acceptCounts) {
      const frequency = count / Math.max(totalProjects, 1);
      if (frequency >= 0.7 && count >= 3) {
        patterns.push({
          id: `pattern-team-preference-${criterionId}`,
          type: "team-preference",
          criterionIds: [criterionId],
          confidence: Math.min(frequency, 0.95),
          description: `Team consistently values criterion "${criterionId}"`,
          suggestedAction: "Consider increasing weight for future audits",
          occurrences: count,
        });
      }
    }

    // Detect disagreement patterns from feedback
    const disagreeCounts = new Map<string, number>();
    for (const project of projects) {
      for (const feedback of project.feedbackLog) {
        if (feedback.type === "disagree") {
          disagreeCounts.set(
            feedback.criterionId,
            (disagreeCounts.get(feedback.criterionId) ?? 0) + 1
          );
        }
      }
    }

    for (const [criterionId, count] of disagreeCounts) {
      if (count >= 4) {
        patterns.push({
          id: `pattern-project-specific-${criterionId}`,
          type: "project-specific",
          criterionIds: [criterionId],
          confidence: Math.min(count / (totalProjects * 2), 0.9),
          description: `Frequent disagreement with "${criterionId}" findings`,
          suggestedAction: "Review criterion relevance or adjust thresholds",
          occurrences: count,
        });
      }
    }

    return patterns;
  }

  /**
   * Recommend criteria based on historical data from similar project types.
   * @param projectType - e.g., "e-commerce", "saas-dashboard", "mobile-app"
   */
  suggestCriteria(projectType: string): AuditCriterion[] {
    // Base criteria with type-specific weighting
    const baseCriteria: Record<string, AuditCriterion[]> = {
      "e-commerce": [
        { id: "a11y-contrast", name: "Color contrast ratio", weight: 0.9, category: "accessibility" },
        { id: "cta-visibility", name: "CTA button visibility", weight: 0.95, category: "conversion" },
        { id: "form-validation", name: "Form error handling", weight: 0.85, category: "usability" },
        { id: "loading-states", name: "Loading state feedback", weight: 0.8, category: "performance" },
        { id: "mobile-touch", name: "Touch target sizes", weight: 0.9, category: "mobile" },
      ],
      "saas-dashboard": [
        { id: "data-density", name: "Information density", weight: 0.85, category: "usability" },
        { id: "nav-consistency", name: "Navigation consistency", weight: 0.9, category: "navigation" },
        { id: "empty-states", name: "Empty state handling", weight: 0.8, category: "usability" },
        { id: "keyboard-nav", name: "Keyboard navigation", weight: 0.85, category: "accessibility" },
        { id: "error-recovery", name: "Error recovery paths", weight: 0.9, category: "resilience" },
      ],
      "mobile-app": [
        { id: "thumb-zone", name: "Thumb zone optimization", weight: 0.9, category: "mobile" },
        { id: "gesture-hints", name: "Gesture discoverability", weight: 0.8, category: "usability" },
        { id: "offline-mode", name: "Offline state handling", weight: 0.85, category: "resilience" },
        { id: "haptic-feedback", name: "Haptic feedback usage", weight: 0.7, category: "interaction" },
        { id: "safe-area", name: "Safe area compliance", weight: 0.95, category: "layout" },
      ],
    };

    return baseCriteria[projectType] ?? [
      { id: "a11y-contrast", name: "Color contrast ratio", weight: 0.85, category: "accessibility" },
      { id: "responsive", name: "Responsive breakpoints", weight: 0.8, category: "layout" },
      { id: "loading-states", name: "Loading state feedback", weight: 0.75, category: "performance" },
      { id: "error-handling", name: "Error state handling", weight: 0.8, category: "resilience" },
      { id: "consistency", name: "Visual consistency", weight: 0.85, category: "design-system" },
    ];
  }

  /**
   * Export all accumulated knowledge for backup or sharing.
   */
  exportKnowledge(
    projects: ProjectMemoryEntry[],
    patterns: LearningPattern[]
  ): KnowledgeSnapshot {
    const globalWeights = Object.fromEntries(this.aggregateWeights(projects));

    return {
      version: KNOWLEDGE_VERSION,
      exportedAt: Date.now(),
      projects,
      patterns,
      globalWeights,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MemoryPersistence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles localStorage persistence and optional Supabase remote sync.
 */
export class MemoryPersistence {
  private readonly prefix: string;

  constructor(prefix = STORAGE_PREFIX) {
    this.prefix = prefix;
  }

  /** Save a project memory entry to localStorage. */
  saveLocal(entry: ProjectMemoryEntry): void {
    const key = `${this.prefix}project.${entry.projectId}`;
    const serialized = JSON.stringify(serializeEntry(entry));
    localStorage.setItem(key, serialized);

    // Update project index
    this.updateProjectIndex(entry);
  }

  /** Load a project memory entry from localStorage. */
  loadLocal(projectId: string): ProjectMemoryEntry | null {
    const key = `${this.prefix}project.${projectId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as SerializedProjectMemoryEntry;
      return deserializeEntry(parsed);
    } catch {
      return null;
    }
  }

  /** List all projects stored in localStorage. */
  listProjects(): Array<{
    id: string;
    name: string;
    lastAudit: number;
    score: number;
  }> {
    const indexKey = `${this.prefix}index`;
    const raw = localStorage.getItem(indexKey);
    if (!raw) return [];

    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /** Optional: sync a project entry to Supabase. */
  async syncToRemote?(entry: ProjectMemoryEntry): Promise<void> {
    // Placeholder for Supabase integration.
    // Implementation would use supabase.from("audit_memory").upsert(...)
    const _serialized = serializeEntry(entry);
    void _serialized;
    throw new Error(
      "Remote sync not configured. Set SUPABASE_URL and SUPABASE_KEY."
    );
  }

  /** Optional: import a project entry from Supabase. */
  async importFromRemote?(
    projectId: string
  ): Promise<ProjectMemoryEntry | null> {
    // Placeholder for Supabase integration.
    void projectId;
    throw new Error(
      "Remote sync not configured. Set SUPABASE_URL and SUPABASE_KEY."
    );
  }

  /** Remove a project from localStorage (GDPR compliance). */
  removeLocal(projectId: string): void {
    const key = `${this.prefix}project.${projectId}`;
    localStorage.removeItem(key);

    // Update index
    const projects = this.listProjects().filter((p) => p.id !== projectId);
    localStorage.setItem(`${this.prefix}index`, JSON.stringify(projects));
  }

  /** Clear all memory data from localStorage. */
  clearAll(): void {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private updateProjectIndex(entry: ProjectMemoryEntry): void {
    const indexKey = `${this.prefix}index`;
    const projects = this.listProjects();

    const existing = projects.findIndex((p) => p.id === entry.projectId);
    const summary = {
      id: entry.projectId,
      name: entry.projectName,
      lastAudit: entry.timestamp,
      score: entry.auditScore,
    };

    if (existing >= 0) {
      projects[existing] = summary;
    } else {
      projects.push(summary);
    }

    localStorage.setItem(indexKey, JSON.stringify(projects));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MemoryAgent
// ─────────────────────────────────────────────────────────────────────────────

/** Internal tagged memory item used by MemoryAgent. */
interface MemoryItem {
  id: string;
  tags: string[];
  data: unknown;
  projectId: string | null;
  confidence: number;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Intelligent memory coordinator that provides semantic storage and recall.
 * Manages short-term vs long-term memory with confidence-based consolidation.
 */
export class MemoryAgent {
  private shortTerm: MemoryItem[] = [];
  private longTerm: MemoryItem[] = [];
  private forgottenLog: Array<{
    criterionId: string;
    reason: string;
    timestamp: number;
  }> = [];

  private readonly consolidationThreshold: number;
  private readonly maxShortTerm: number;

  constructor(consolidationThreshold = 0.75, maxShortTerm = 100) {
    this.consolidationThreshold = consolidationThreshold;
    this.maxShortTerm = maxShortTerm;
  }

  /**
   * Store data with semantic tags derived from the context string.
   * Stored initially in short-term memory.
   */
  remember(context: string, data: unknown, projectId?: string): void {
    const tags = this.extractTags(context);
    const item: MemoryItem = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tags,
      data,
      projectId: projectId ?? null,
      confidence: 0.5,
      createdAt: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.shortTerm.push(item);

    // Evict oldest short-term memories if over capacity
    if (this.shortTerm.length > this.maxShortTerm) {
      this.shortTerm.sort((a, b) => b.lastAccessed - a.lastAccessed);
      this.shortTerm = this.shortTerm.slice(0, this.maxShortTerm);
    }
  }

  /**
   * Recall stored memories matching a query, optionally scoped to a project.
   * Results are ranked by relevance (tag overlap + recency + confidence).
   */
  recall(query: string, projectId?: string): unknown[] {
    const queryTags = this.extractTags(query);
    const allItems = [...this.longTerm, ...this.shortTerm];

    const scored = allItems
      .filter((item) => {
        if (projectId && item.projectId && item.projectId !== projectId) {
          return false;
        }
        return true;
      })
      .map((item) => {
        const tagOverlap = this.computeTagOverlap(queryTags, item.tags);
        const recency = 1 / (1 + (Date.now() - item.lastAccessed) / 86400000);
        const score = tagOverlap * 0.6 + recency * 0.2 + item.confidence * 0.2;

        // Boost access count
        item.accessCount++;
        item.lastAccessed = Date.now();

        return { item, score };
      })
      .filter(({ score }) => score > 0.1)
      .sort((a, b) => b.score - a.score);

    return scored.map(({ item }) => item.data);
  }

  /**
   * Explicitly forget a criterion's data (GDPR right to be forgotten).
   * Logs the forgetting event for audit trail.
   */
  forget(criterionId: string, reason: string): void {
    this.shortTerm = this.shortTerm.filter(
      (item) => !item.tags.includes(criterionId)
    );
    this.longTerm = this.longTerm.filter(
      (item) => !item.tags.includes(criterionId)
    );

    this.forgottenLog.push({
      criterionId,
      reason,
      timestamp: Date.now(),
    });
  }

  /**
   * Consolidate short-term memories into long-term storage.
   * Only items with confidence above the threshold are promoted.
   * Remaining low-confidence items are discarded if stale.
   */
  consolidate(): void {
    const promoted: MemoryItem[] = [];
    const retained: MemoryItem[] = [];

    for (const item of this.shortTerm) {
      // Confidence grows with access and age
      const ageBonus = Math.min(
        (Date.now() - item.createdAt) / (7 * 86400000),
        0.3
      );
      const accessBonus = Math.min(item.accessCount * 0.1, 0.3);
      item.confidence = Math.min(item.confidence + ageBonus + accessBonus, 1.0);

      if (item.confidence >= this.consolidationThreshold) {
        promoted.push(item);
      } else {
        // Keep if less than 7 days old
        const isRecent = Date.now() - item.createdAt < 7 * 86400000;
        if (isRecent) {
          retained.push(item);
        }
      }
    }

    this.longTerm.push(...promoted);
    this.shortTerm = retained;
  }

  /** Get the forgotten log for audit purposes. */
  getForgottenLog(): ReadonlyArray<{
    criterionId: string;
    reason: string;
    timestamp: number;
  }> {
    return this.forgottenLog;
  }

  /** Get current memory stats. */
  getStats(): {
    shortTermCount: number;
    longTermCount: number;
    forgottenCount: number;
  } {
    return {
      shortTermCount: this.shortTerm.length,
      longTermCount: this.longTerm.length,
      forgottenCount: this.forgottenLog.length,
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  /** Extract semantic tags from a context string. */
  private extractTags(context: string): string[] {
    const normalized = context.toLowerCase();
    // Split on non-alphanumeric, filter short tokens
    const tokens = normalized
      .split(/[^a-z0-9-]+/)
      .filter((t) => t.length > 2);
    // Deduplicate
    return [...new Set(tokens)];
  }

  /** Compute Jaccard-like overlap between two tag sets. */
  private computeTagOverlap(a: string[], b: string[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    const setB = new Set(b);
    const intersection = a.filter((tag) => setB.has(tag)).length;
    const union = new Set([...a, ...b]).size;
    return intersection / union;
  }
}
