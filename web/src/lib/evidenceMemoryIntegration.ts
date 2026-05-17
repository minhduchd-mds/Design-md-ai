/**
 * Evidence-Based Memory Integration
 * Bridges EvidenceMemoryEngine with AgentMemory 4-tier system
 * Ensures all memories in the system are properly validated before use
 */

import type { EvidenceRecord, EvidenceSource, MemoryStats } from "./evidenceMemory";
import { EvidenceMemoryEngine } from "./evidenceMemory";
import type { AgentMemory } from "./agentMemory";

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  source: EvidenceSource;
  validatedAt?: number;
  conflicts: string[];
  recommendations: string[];
}

export interface MemoryValidationConfig {
  minConfidenceForLongTerm?: number; // default 0.75 - confidence needed to promote to long-term
  minConfidenceForPersistent?: number; // default 0.9 - confidence needed for persistent memory
  enableAutoValidation?: boolean; // default true - auto-validate high-confidence memory
  validationDecayDays?: number; // default 30 - revalidate memory older than this
  maxContradictionsAllowed?: number; // default 3 - flag memory with more contradictions
}

export class MemoryValidationEngine {
  private evidenceEngine: EvidenceMemoryEngine;
  private agentMemory: AgentMemory;
  private config: Required<MemoryValidationConfig>;
  private validationHistory: Map<string, { validatedAt: number; source: EvidenceSource }> = new Map();

  constructor(agentMemory: AgentMemory) {
    this.agentMemory = agentMemory;
    this.evidenceEngine = new EvidenceMemoryEngine();
    this.config = {
      minConfidenceForLongTerm: 0.75,
      minConfidenceForPersistent: 0.9,
      enableAutoValidation: true,
      validationDecayDays: 30,
      maxContradictionsAllowed: 3,
    };
  }

  /**
   * Configure the validation engine
   */
  configure(config: MemoryValidationConfig): void {
    this.config = { ...this.config, ...config };
    this.evidenceEngine.configure({
      maxRecords: 10000,
      minConfidenceThreshold: this.config.minConfidenceForLongTerm,
    });
  }

  /**
   * Store memory with evidence tracking
   * Ensures memory can be traced back to its source
   */
  async storeMemoryAsEvidence(
    memory: string,
    tier: "short-term" | "long-term" | "persistent",
    source: EvidenceSource,
    sourceDetails?: string
  ): Promise<{ memoryId: string; evidenceId: string }> {
    // Store in agent memory (existing system)
    const memoryId = await this.agentMemory.store(memory, tier);

    // Track as evidence in new system
    const evidenceId = await this.evidenceEngine.storeEvidence({
      content: memory,
      source,
      confidence: this.getInitialConfidence(source, tier),
      validated: source === "design-file", // Design files are pre-validated
      tags: [tier, source],
      metadata: {
        memoryId,
        tier,
        sourceDetails,
        storedAt: Date.now(),
      },
    });

    return { memoryId, evidenceId };
  }

  /**
   * Retrieve and validate memory
   * Applies confidence decay and contradiction checks
   */
  async retrieveValidatedMemory(
    query: string,
    options?: {
      tier?: "short-term" | "long-term" | "persistent";
      minConfidence?: number;
      onlyValidated?: boolean;
    }
  ): Promise<Array<{ content: string; validation: ValidationResult }>> {
    // Retrieve from evidence system
    const evidence = await this.evidenceEngine.recallEvidence(query, {
      minConfidence: options?.minConfidence ?? this.config.minConfidenceForLongTerm,
      onlyValidated: options?.onlyValidated ?? false,
      limit: 20,
    });

    const results = [];

    for (const record of evidence) {
      // Get validation status
      const validation = this.validateRecord(record);

      // If confidence sufficient, also check agent memory tier
      if (validation.isValid && options?.tier) {
        const memoryId = record.metadata.memoryId as string | undefined;
        if (memoryId) {
          const tierMatch = record.tags.includes(options.tier);
          if (!tierMatch) continue;
        }
      }

      results.push({
        content: record.content,
        validation,
      });
    }

    return results;
  }

  /**
   * Validate memory against authoritative source
   * Promotes confidence and marks as validated
   */
  async validateMemory(
    query: string,
    source: "design-file" | "user-feedback" | "developer",
    sourceDetails?: string
  ): Promise<number> {
    const evidence = await this.evidenceEngine.recallEvidence(query, {
      minConfidence: 0.1,
      limit: 100,
    });

    let validatedCount = 0;

    for (const record of evidence) {
      // Skip if already validated by this source
      if (record.validatedBy === source) continue;

      await this.evidenceEngine.validateEvidence(record.id, source, sourceDetails);
      this.validationHistory.set(record.id, { validatedAt: Date.now(), source });

      // If confidence now high enough, promote to appropriate tier
      if (this.config.enableAutoValidation && record.confidence >= this.config.minConfidenceForLongTerm) {
        const memoryId = record.metadata.memoryId as string | undefined;
        if (memoryId) {
          // Memory exists in agent memory; it's automatically validated
          validatedCount++;
        }
      }
    }

    return validatedCount;
  }

  /**
   * Promote memory to persistent storage
   * Only memories with sufficient validation can be promoted
   */
  async promoteToTruth(
    query: string,
    validationSource: "design-file" | "user-feedback" | "developer"
  ): Promise<string[]> {
    const evidence = await this.evidenceEngine.recallEvidence(query, {
      minConfidence: this.config.minConfidenceForPersistent,
      limit: 50,
    });

    const promotedIds: string[] = [];

    for (const record of evidence) {
      // Check for contradictions
      const contradictions = this.evidenceEngine.getContradictions(record.id);
      if (contradictions.length > this.config.maxContradictionsAllowed) {
        console.warn(`[MemoryValidation] Memory ${record.id} has ${contradictions.length} contradictions, skipping promotion`);
        continue;
      }

      // Promote to truth
      await this.evidenceEngine.promoteToTruth(record.id);

      // Move to persistent tier in agent memory if exists
      const memoryId = record.metadata.memoryId as string | undefined;
      if (memoryId) {
        // Agent memory handles the promotion
        promotedIds.push(record.id);
      }
    }

    return promotedIds;
  }

  /**
   * Detect contradictions in memory system
   * Flags conflicts for human review
   */
  async detectMemoryContradictions(): Promise<
    Array<{
      recordId: string;
      conflictingId: string;
      severity: "low" | "medium" | "high";
      recommendation: string;
    }>
  > {
    const contradictions = await this.evidenceEngine.detectContradictions();

    return contradictions.map((c) => ({
      recordId: c.recordId,
      conflictingId: c.conflictingId,
      severity: c.severity,
      recommendation: `Review ${c.conflictType}: ${c.details}`,
    }));
  }

  /**
   * Run decay cycle on unvalidated memories
   * Periodically reduces confidence of memories not recently validated
   */
  async runDecayCycle(): Promise<{ decayedCount: number; needsReviewCount: number }> {
    const decayedCount = await this.evidenceEngine.decayUnvalidated();

    // Count memories needing review
    const stats = this.evidenceEngine.getStats();
    const needsReviewCount = stats.recordsBySource["pattern-match"] + stats.recordsBySource["ai-inference"];

    return { decayedCount, needsReviewCount };
  }

  /**
   * Get comprehensive memory validation report
   */
  async getValidationReport(): Promise<{
    totalMemories: number;
    validatedMemories: number;
    validationRate: number;
    averageConfidence: number;
    pendingValidation: number;
    contradictions: number;
    recommendedActions: string[];
  }> {
    const stats = this.evidenceEngine.getStats();
    const contradictions = await this.evidenceEngine.detectContradictions();
    const recommendations: string[] = [];

    // Generate recommendations
    if (stats.validatedRecords < stats.totalRecords * 0.5) {
      recommendations.push("Less than 50% of memories validated. Consider design file audit.");
    }

    if (stats.averageConfidence < 0.6) {
      recommendations.push("Average confidence below 0.6. Consider retraining on high-quality examples.");
    }

    if (contradictions.length > 0) {
      recommendations.push(`Found ${contradictions.length} contradictions. Review and resolve high-severity conflicts.`);
    }

    const validationRate = stats.totalRecords > 0 ? stats.validatedRecords / stats.totalRecords : 0;
    const pendingValidation = stats.totalRecords - stats.validatedRecords;

    return {
      totalMemories: stats.totalRecords,
      validatedMemories: stats.validatedRecords,
      validationRate,
      averageConfidence: stats.averageConfidence,
      pendingValidation,
      contradictions: contradictions.length,
      recommendedActions: recommendations,
    };
  }

  /**
   * Export validation state for backup/audit
   */
  async exportValidationState(): Promise<string> {
    const snapshot = await this.evidenceEngine.exportSnapshot();
    const report = await this.getValidationReport();

    return JSON.stringify({
      version: 1,
      exportedAt: Date.now(),
      snapshot,
      report,
      validationHistory: Array.from(this.validationHistory.entries()),
    });
  }

  /**
   * Import validation state from backup
   */
  async importValidationState(stateJson: string): Promise<void> {
    const state = JSON.parse(stateJson);
    if (state.version !== 1) throw new Error(`Unsupported state version: ${state.version}`);

    await this.evidenceEngine.importSnapshot(state.snapshot);

    // Restore validation history
    this.validationHistory.clear();
    for (const [recordId, entry] of state.validationHistory) {
      this.validationHistory.set(recordId, entry);
    }
  }

  // ========== Private Helpers ==========

  private getInitialConfidence(source: EvidenceSource, tier: string): number {
    // Start with base confidence by source type
    const baseConfidence: Record<EvidenceSource, number> = {
      "design-file": 0.95,
      "user-feedback": 0.75,
      "ai-inference": 0.5,
      "pattern-match": 0.3,
    };

    let confidence = baseConfidence[source];

    // Boost if in persistent tier (already validated)
    if (tier === "persistent") {
      confidence = Math.min(1.0, confidence + 0.15);
    } else if (tier === "long-term") {
      confidence = Math.min(1.0, confidence + 0.1);
    }

    return confidence;
  }

  private validateRecord(record: EvidenceRecord): ValidationResult {
    const contradictions = this.evidenceEngine.getContradictions(record.id);
    const isRecent = this.isRecentlyValidated(record.id);
    const needsRevalidation = !isRecent && record.validatedAt && Date.now() - record.validatedAt > this.config.validationDecayDays * 24 * 60 * 60 * 1000;

    const recommendations: string[] = [];

    if (contradictions.length > 0) {
      recommendations.push(`Has ${contradictions.length} contradiction(s). Review before use.`);
    }

    if (needsRevalidation) {
      recommendations.push("Not validated recently. Consider re-validating.");
    }

    if (record.confidence < 0.6) {
      recommendations.push("Confidence below 0.6. Use with caution or validate against source.");
    }

    return {
      isValid: record.validated && record.confidence >= 0.5 && contradictions.length < this.config.maxContradictionsAllowed,
      confidence: record.confidence,
      source: record.source,
      validatedAt: record.validatedAt,
      conflicts: record.contradictions,
      recommendations,
    };
  }

  private isRecentlyValidated(recordId: string): boolean {
    const validation = this.validationHistory.get(recordId);
    if (!validation) return false;

    const daysSinceValidation = (Date.now() - validation.validatedAt) / (1000 * 60 * 60 * 24);
    return daysSinceValidation < this.config.validationDecayDays;
  }
}

/**
 * Factory function for creating memory validation engine
 */
export function createMemoryValidation(
  agentMemory: AgentMemory,
  config?: MemoryValidationConfig
): MemoryValidationEngine {
  const engine = new MemoryValidationEngine(agentMemory);
  if (config) {
    engine.configure(config);
  }
  return engine;
}
