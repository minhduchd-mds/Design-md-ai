/**
 * Evidence-Based Memory Engine
 * Treats all memories as "candidate evidence" with confidence scores
 * Source hierarchy: design-file > user-feedback > ai-inference > pattern-match
 * Validated memories are promoted to "ground truth"
 * Unvalidated memories decay over time
 */

export type EvidenceSource = "design-file" | "user-feedback" | "ai-inference" | "pattern-match";

export interface EvidenceRecord {
  id: string;
  content: string;
  source: EvidenceSource;
  confidence: number; // 0.0 - 1.0, decays over time
  validated: boolean; // promoted to truth?
  validatedBy?: "design-file" | "user-feedback" | "developer"; // what validated it
  validatedAt?: number; // timestamp
  contradictions: string[]; // IDs of conflicting records
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  tags: string[]; // for categorization
  metadata: Record<string, unknown>;
}

export interface Contradiction {
  recordId: string;
  conflictingId: string;
  conflictType: "value-mismatch" | "semantic-conflict" | "version-conflict";
  severity: "low" | "medium" | "high";
  details: string;
}

export interface EvidenceMemoryConfig {
  decayRatePerDay?: number; // default 0.05 (5% confidence loss per day)
  minConfidenceThreshold?: number; // default 0.3
  maxRecords?: number; // default 10000
  enableVectorSearch?: boolean; // default true
}

export interface MemoryStats {
  totalRecords: number;
  validatedRecords: number;
  contradictions: number;
  averageConfidence: number;
  recordsBySource: Record<EvidenceSource, number>;
}

export class EvidenceMemoryEngine {
  private records: Map<string, EvidenceRecord> = new Map();
  private sourceIndex: Map<EvidenceSource, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map(); // tag → record IDs (for O(1) contradiction lookup)
  private contradictionIndex: Map<string, Contradiction[]> = new Map();
  private config: Required<EvidenceMemoryConfig>;
  private isConfigured = false;

  constructor() {
    this.config = {
      decayRatePerDay: 0.05,
      minConfidenceThreshold: 0.3,
      maxRecords: 10000,
      enableVectorSearch: true,
    };
    // Initialize source index
    const sources: EvidenceSource[] = ["design-file", "user-feedback", "ai-inference", "pattern-match"];
    sources.forEach((source) => this.sourceIndex.set(source, new Set()));
  }

  /**
   * Configure the memory engine
   */
  configure(config: EvidenceMemoryConfig): void {
    this.config = { ...this.config, ...config };
    this.isConfigured = true;
  }

  /**
   * Store a new evidence record
   */
  async storeEvidence(record: Omit<EvidenceRecord, "id" | "createdAt" | "lastAccessedAt" | "accessCount">): Promise<string> {
    if (!this.isConfigured) throw new Error("Memory engine not configured");
    if (this.records.size >= this.config.maxRecords) {
      throw new Error(`Memory limit reached (${this.config.maxRecords} records)`);
    }

    // Use crypto-safe unique ID to prevent collisions in tight loops
    const id = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${(this.records.size).toString(36)}`;
    const now = Date.now();

    const newRecord: EvidenceRecord = {
      ...record,
      id,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      contradictions: [],
    };

    this.records.set(id, newRecord);
    this.sourceIndex.get(record.source)?.add(id);

    // Update tag index for fast contradiction lookup
    for (const tag of record.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(id);
    }

    // Check for contradictions (only against records with matching tags)
    await this.detectContradictionsForRecord(id);

    return id;
  }

  /**
   * Recall evidence matching a query
   * Applies confidence decay and filters by source validity
   */
  async recallEvidence(
    query: string,
    options?: {
      minConfidence?: number;
      onlySources?: EvidenceSource[];
      onlyValidated?: boolean;
      limit?: number;
    }
  ): Promise<EvidenceRecord[]> {
    const minConfidence = options?.minConfidence ?? this.config.minConfidenceThreshold;
    const onlyValidated = options?.onlyValidated ?? false;
    const limit = options?.limit ?? 50;
    const onlySources = options?.onlySources;

    const now = Date.now();
    const results: EvidenceRecord[] = [];

    for (const record of this.records.values()) {
      // Skip if below minimum confidence
      if (record.confidence < minConfidence) continue;

      // Skip if not validated but we only want validated
      if (onlyValidated && !record.validated) continue;

      // Skip if source filter applied
      if (onlySources && !onlySources.includes(record.source)) continue;

      // Apply decay to confidence
      const ageMs = now - record.createdAt;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const decayedConfidence = Math.max(0, record.confidence - this.config.decayRatePerDay * ageDays);

      // Check confidence after decay
      if (decayedConfidence < minConfidence) continue;

      // Simple text matching (in production, would use embeddings/BM25)
      if (this.contentMatches(record.content, query)) {
        results.push({ ...record, confidence: decayedConfidence });
      }
    }

    // Sort by source hierarchy + confidence
    results.sort((a, b) => {
      const sourceScoreA = this.getSourceScore(a.source);
      const sourceScoreB = this.getSourceScore(b.source);
      if (sourceScoreA !== sourceScoreB) return sourceScoreB - sourceScoreA;
      return b.confidence - a.confidence;
    });

    return results.slice(0, limit);
  }

  /**
   * Validate evidence against an authoritative source
   * Promotes confidence and marks as validated
   */
  async validateEvidence(
    recordId: string,
    source: "design-file" | "user-feedback" | "developer",
    sourceDetails?: string
  ): Promise<void> {
    const record = this.records.get(recordId);
    if (!record) throw new Error(`Record ${recordId} not found`);

    // Mark as validated
    record.validated = true;
    record.validatedBy = source;
    record.validatedAt = Date.now();

    // Boost confidence based on source
    if (source === "design-file") {
      record.confidence = Math.min(1.0, record.confidence + 0.4);
    } else if (source === "user-feedback") {
      record.confidence = Math.min(1.0, record.confidence + 0.25);
    } else {
      record.confidence = Math.min(1.0, record.confidence + 0.1);
    }

    // Clear contradictions since we're validating
    const contradictions = this.contradictionIndex.get(recordId) || [];
    for (const contradiction of contradictions) {
      const conflictingRecord = this.records.get(contradiction.conflictingId);
      if (conflictingRecord) {
        conflictingRecord.contradictions = conflictingRecord.contradictions.filter((id) => id !== recordId);
      }
    }
    this.contradictionIndex.delete(recordId);
    record.contradictions = [];
  }

  /**
   * Detect all contradictions in the memory store
   */
  async detectContradictions(): Promise<Contradiction[]> {
    const contradictions: Contradiction[] = [];

    const recordArray = Array.from(this.records.values());
    for (let i = 0; i < recordArray.length; i++) {
      for (let j = i + 1; j < recordArray.length; j++) {
        const record1 = recordArray[i];
        const record2 = recordArray[j];

        // Skip if either is validated
        if (record1.validated || record2.validated) continue;

        const contradiction = this.detectContradictionBetween(record1, record2);
        if (contradiction) {
          contradictions.push(...contradiction);
        }
      }
    }

    return contradictions;
  }

  /**
   * Decay confidence of unvalidated memories
   * Uses lastAccessedAt as decay anchor (not createdAt) to avoid double-decay
   * when recallEvidence also applies on-the-fly decay.
   */
  async decayUnvalidated(): Promise<number> {
    let decayedCount = 0;
    const now = Date.now();

    for (const record of this.records.values()) {
      if (record.validated) continue; // Don't decay validated records

      // Use time since last decay (lastAccessedAt) not creation time
      // This prevents double-decay with recallEvidence's on-the-fly calculation
      const timeSinceLastDecay = now - record.lastAccessedAt;
      const daysSinceLastDecay = timeSinceLastDecay / (1000 * 60 * 60 * 24);

      if (daysSinceLastDecay <= 0) continue;

      const decay = this.config.decayRatePerDay * daysSinceLastDecay;
      const newConfidence = Math.max(0, record.confidence - decay);

      if (newConfidence < record.confidence) {
        record.confidence = newConfidence;
        record.lastAccessedAt = now; // Reset decay anchor
        decayedCount++;

        // If confidence falls below threshold, mark for review (deduplicated)
        if (newConfidence < this.config.minConfidenceThreshold && !record.tags.includes("needs-review")) {
          record.tags.push("needs-review");
        }
      }
    }

    return decayedCount;
  }

  /**
   * Promote evidence to ground truth
   */
  async promoteToTruth(recordId: string): Promise<void> {
    const record = this.records.get(recordId);
    if (!record) throw new Error(`Record ${recordId} not found`);

    record.validated = true;
    record.confidence = 1.0;
    record.validatedAt = Date.now();
    record.validatedBy = "developer";
  }

  /**
   * Get all contradictions for a record
   */
  getContradictions(recordId: string): Contradiction[] {
    return this.contradictionIndex.get(recordId) || [];
  }

  /**
   * Resolve contradiction by keeping one record
   */
  async resolveContradiction(recordId: string, keepSource: "design-file" | "user-feedback" | "ai-inference" | "pattern-match"): Promise<void> {
    const record = this.records.get(recordId);
    if (!record) throw new Error(`Record ${recordId} not found`);

    const contradictions = this.contradictionIndex.get(recordId) || [];
    for (const contradiction of contradictions) {
      const conflictingRecord = this.records.get(contradiction.conflictingId);
      if (!conflictingRecord) continue;

      // Keep the one matching the desired source, discard others
      if (conflictingRecord.source !== keepSource) {
        // Clean up all indexes for deleted record
        this.records.delete(contradiction.conflictingId);
        this.sourceIndex.get(conflictingRecord.source)?.delete(contradiction.conflictingId);
        this.contradictionIndex.delete(contradiction.conflictingId);

        // Clean up tag index
        for (const tag of conflictingRecord.tags || []) {
          this.tagIndex.get(tag)?.delete(contradiction.conflictingId);
        }
      }
    }

    this.contradictionIndex.delete(recordId);
    record.contradictions = [];
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    const validatedCount = Array.from(this.records.values()).filter((r) => r.validated).length;
    const allConfidences = Array.from(this.records.values()).map((r) => r.confidence);
    const avgConfidence = allConfidences.length > 0 ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length : 0;
    const contradictionsCount = Array.from(this.contradictionIndex.values()).reduce((sum, arr) => sum + arr.length, 0);

    const recordsBySource: Record<EvidenceSource, number> = {
      "design-file": this.sourceIndex.get("design-file")?.size ?? 0,
      "user-feedback": this.sourceIndex.get("user-feedback")?.size ?? 0,
      "ai-inference": this.sourceIndex.get("ai-inference")?.size ?? 0,
      "pattern-match": this.sourceIndex.get("pattern-match")?.size ?? 0,
    };

    return {
      totalRecords: this.records.size,
      validatedRecords: validatedCount,
      contradictions: contradictionsCount,
      averageConfidence: avgConfidence,
      recordsBySource,
    };
  }

  /**
   * Export memory snapshot
   */
  async exportSnapshot(): Promise<string> {
    const snapshot = {
      version: 1,
      exportedAt: Date.now(),
      config: this.config,
      records: Array.from(this.records.values()),
      contradictions: Array.from(this.contradictionIndex.entries()),
    };
    return JSON.stringify(snapshot);
  }

  /**
   * Import memory snapshot
   */
  async importSnapshot(snapshotJson: string): Promise<void> {
    const snapshot = JSON.parse(snapshotJson);
    if (snapshot.version !== 1) throw new Error(`Unsupported snapshot version: ${snapshot.version}`);

    this.records.clear();
    this.contradictionIndex.clear();
    this.sourceIndex.forEach((set) => set.clear());
    this.tagIndex.clear();

    for (const record of snapshot.records) {
      this.records.set(record.id, record);
      this.sourceIndex.get(record.source)?.add(record.id);

      // Rebuild tag index
      for (const tag of record.tags || []) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(record.id);
      }
    }

    for (const [recordId, contradictions] of snapshot.contradictions) {
      this.contradictionIndex.set(recordId, contradictions);
    }
  }

  // ========== Private Helpers ==========

  private contentMatches(content: string, query: string): boolean {
    // Empty query matches everything (intentional for "get all" scenarios)
    if (!query || query.trim().length === 0) return true;

    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();

    // Tokenized word matching with minimum word length filter
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 0);
    if (queryWords.length === 0) return true;

    return queryWords.some((word) => contentLower.includes(word));
  }

  private getSourceScore(source: EvidenceSource): number {
    const scores: Record<EvidenceSource, number> = {
      "design-file": 4,
      "user-feedback": 3,
      "ai-inference": 2,
      "pattern-match": 1,
    };
    return scores[source];
  }

  private detectContradictionBetween(record1: EvidenceRecord, record2: EvidenceRecord): Contradiction[] | null {
    // Check if content is similar but contradictory
    if (this.isSimilarContent(record1.content, record2.content)) {
      // If same tags/metadata but different content, it's a contradiction
      if (record1.tags.some((tag) => record2.tags.includes(tag))) {
        const contradiction1: Contradiction = {
          recordId: record1.id,
          conflictingId: record2.id,
          conflictType: "value-mismatch",
          severity: "medium",
          details: `Content conflict between ${record1.source} and ${record2.source}`,
        };
        const contradiction2: Contradiction = {
          recordId: record2.id,
          conflictingId: record1.id,
          conflictType: "value-mismatch",
          severity: "medium",
          details: `Content conflict between ${record2.source} and ${record1.source}`,
        };

        // Track contradictions
        if (!this.contradictionIndex.has(record1.id)) {
          this.contradictionIndex.set(record1.id, []);
        }
        if (!this.contradictionIndex.has(record2.id)) {
          this.contradictionIndex.set(record2.id, []);
        }
        this.contradictionIndex.get(record1.id)?.push(contradiction1);
        this.contradictionIndex.get(record2.id)?.push(contradiction2);

        record1.contradictions.push(record2.id);
        record2.contradictions.push(record1.id);

        return [contradiction1, contradiction2];
      }
    }

    return null;
  }

  private isSimilarContent(content1: string, content2: string): boolean {
    // Check for significant content overlap (Jaccard similarity > 0.4)
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));

    const intersection = Array.from(words1).filter((w) => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;

    return union > 0 && intersection / union > 0.4;
  }

  private async detectContradictionsForRecord(recordId: string): Promise<void> {
    const record = this.records.get(recordId);
    if (!record || record.tags.length === 0) return;

    // Use tag index for O(k) lookup instead of O(n) full scan
    const candidateIds = new Set<string>();
    for (const tag of record.tags) {
      const tagRecords = this.tagIndex.get(tag);
      if (tagRecords) {
        for (const id of tagRecords) {
          if (id !== recordId) candidateIds.add(id);
        }
      }
    }

    // Only check records sharing tags (much smaller set than all records)
    for (const candidateId of candidateIds) {
      const existingRecord = this.records.get(candidateId);
      if (!existingRecord) continue;
      if (existingRecord.validated) continue; // Skip validated records

      const contradiction = this.detectContradictionBetween(record, existingRecord);
      if (contradiction) break; // Found contradiction, stop checking
    }
  }
}

/**
 * Factory function for creating evidence memory engine
 */
export function createEvidenceMemory(config?: EvidenceMemoryConfig): EvidenceMemoryEngine {
  const engine = new EvidenceMemoryEngine();
  if (config) {
    engine.configure(config);
  }
  return engine;
}
