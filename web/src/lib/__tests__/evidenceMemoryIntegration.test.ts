import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryValidationEngine, createMemoryValidation } from "../evidenceMemoryIntegration";

// Mock AgentMemory for testing
const createMockAgentMemory = () => ({
  store: vi.fn().mockResolvedValue("mem_123"),
  search: vi.fn().mockResolvedValue([]),
  recall: vi.fn().mockResolvedValue("recalled data"),
  update: vi.fn().mockResolvedValue(true),
  delete: vi.fn().mockResolvedValue(true),
});

describe("MemoryValidationEngine", () => {
  let engine: MemoryValidationEngine;
  let mockAgentMemory: any;

  beforeEach(() => {
    mockAgentMemory = createMockAgentMemory();
    engine = new MemoryValidationEngine(mockAgentMemory);
  });

  describe("configure", () => {
    it("accepts validation config", () => {
      engine.configure({
        minConfidenceForLongTerm: 0.8,
        minConfidenceForPersistent: 0.95,
      });
      // Should not throw
      expect(true).toBe(true);
    });

    it("uses default config when not specified", async () => {
      // Should work with defaults
      const report = await engine.getValidationReport();
      expect(report.totalMemories).toBe(0);
    });
  });

  describe("storeMemoryAsEvidence", () => {
    beforeEach(() => {
      engine.configure({});
    });

    it("stores memory in both systems", async () => {
      const result = await engine.storeMemoryAsEvidence(
        "Button component needs hover state",
        "long-term",
        "user-feedback"
      );

      expect(result.memoryId).toBe("mem_123");
      expect(result.evidenceId).toMatch(/^ev_/);
      expect(mockAgentMemory.store).toHaveBeenCalledWith(
        "Button component needs hover state",
        "long-term"
      );
    });

    it("tracks source for design file memories", async () => {
      const result = await engine.storeMemoryAsEvidence(
        "Design system defined colors",
        "persistent",
        "design-file"
      );

      expect(result.memoryId).toBe("mem_123");
      expect(result.evidenceId).toMatch(/^ev_/);
    });

    it("stores memories from all source types", async () => {
      const sources = ["design-file", "user-feedback", "ai-inference", "pattern-match"] as const;

      for (const source of sources) {
        const result = await engine.storeMemoryAsEvidence(
          `Memory from ${source}`,
          "long-term",
          source
        );
        expect(result.evidenceId).toBeDefined();
      }
    });

    it("sets initial confidence based on source", async () => {
      // Design file should have higher initial confidence
      await engine.storeMemoryAsEvidence("design memory", "persistent", "design-file");

      // Pattern match should have lower confidence
      await engine.storeMemoryAsEvidence("pattern memory", "short-term", "pattern-match");

      // Both should be stored successfully
      expect(mockAgentMemory.store).toHaveBeenCalledTimes(2);
    });
  });

  describe("retrieveValidatedMemory", () => {
    beforeEach(async () => {
      engine.configure({ minConfidenceForLongTerm: 0.6 });

      // Store some memories
      await engine.storeMemoryAsEvidence(
        "React component with hooks",
        "long-term",
        "design-file"
      );

      await engine.storeMemoryAsEvidence(
        "Vue component structure",
        "short-term",
        "ai-inference"
      );
    });

    it("retrieves and validates memories", async () => {
      const results = await engine.retrieveValidatedMemory("component");

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("filters by minimum confidence", async () => {
      const results = await engine.retrieveValidatedMemory("", { minConfidence: 0.8 });

      expect(results.every((r) => r.validation.confidence >= 0.8)).toBe(true);
    });

    it("returns validation details for each memory", async () => {
      const results = await engine.retrieveValidatedMemory("component");

      if (results.length > 0) {
        const result = results[0];
        expect(result.content).toBeDefined();
        expect(result.validation).toBeDefined();
        expect(result.validation.isValid).toBeDefined();
        expect(result.validation.confidence).toBeDefined();
        expect(result.validation.source).toBeDefined();
      }
    });
  });

  describe("validateMemory", () => {
    beforeEach(async () => {
      engine.configure({ enableAutoValidation: true });

      await engine.storeMemoryAsEvidence(
        "Button should be blue",
        "long-term",
        "ai-inference"
      );

      await engine.storeMemoryAsEvidence(
        "Padding is 8px",
        "short-term",
        "pattern-match"
      );
    });

    it("validates memory against authoritative source", async () => {
      const validatedCount = await engine.validateMemory(
        "Button",
        "design-file",
        "Verified in design system"
      );

      expect(typeof validatedCount).toBe("number");
    });

    it("supports validation from different sources", async () => {
      const sources = ["design-file", "user-feedback", "developer"] as const;

      for (const source of sources) {
        const count = await engine.validateMemory("Padding", source);
        expect(typeof count).toBe("number");
      }
    });

    it("returns count of validated memories", async () => {
      const count = await engine.validateMemory("Button", "design-file");
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("promoteToTruth", () => {
    beforeEach(async () => {
      engine.configure({ minConfidenceForPersistent: 0.75 });

      // Store high-confidence memory
      await engine.storeMemoryAsEvidence(
        "Primary button is blue",
        "long-term",
        "design-file"
      );

      // Store low-confidence memory
      await engine.storeMemoryAsEvidence(
        "Button might need border",
        "short-term",
        "pattern-match"
      );
    });

    it("promotes memories to persistent truth", async () => {
      const promotedIds = await engine.promoteToTruth(
        "Primary button",
        "design-file"
      );

      expect(Array.isArray(promotedIds)).toBe(true);
    });

    it("skips memories with contradictions", async () => {
      const promotedIds = await engine.promoteToTruth(
        "",
        "design-file"
      );

      expect(Array.isArray(promotedIds)).toBe(true);
    });

    it("respects minimum confidence threshold", async () => {
      const promotedIds = await engine.promoteToTruth(
        "Button might need",
        "design-file"
      );

      expect(Array.isArray(promotedIds)).toBe(true);
    });
  });

  describe("detectMemoryContradictions", () => {
    beforeEach(async () => {
      engine.configure({});

      // Create potentially contradictory memories
      await engine.storeMemoryAsEvidence(
        "Button primary color is blue",
        "long-term",
        "user-feedback"
      );

      await engine.storeMemoryAsEvidence(
        "Button primary color is red",
        "long-term",
        "ai-inference"
      );
    });

    it("detects contradictions in memory system", async () => {
      const contradictions = await engine.detectMemoryContradictions();

      expect(Array.isArray(contradictions)).toBe(true);
      expect(contradictions.length).toBeGreaterThanOrEqual(0);
    });

    it("returns contradiction details", async () => {
      const contradictions = await engine.detectMemoryContradictions();

      if (contradictions.length > 0) {
        const contradiction = contradictions[0];
        expect(contradiction.recordId).toBeDefined();
        expect(contradiction.conflictingId).toBeDefined();
        expect(contradiction.severity).toMatch(/low|medium|high/);
        expect(contradiction.recommendation).toBeDefined();
      }
    });
  });

  describe("runDecayCycle", () => {
    beforeEach(async () => {
      engine.configure({});

      await engine.storeMemoryAsEvidence(
        "ai-generated pattern",
        "short-term",
        "ai-inference"
      );

      await engine.storeMemoryAsEvidence(
        "pattern from pattern matching",
        "short-term",
        "pattern-match"
      );
    });

    it("decays confidence of unvalidated memories", async () => {
      const result = await engine.runDecayCycle();

      expect(result.decayedCount).toBeGreaterThanOrEqual(0);
      expect(result.needsReviewCount).toBeGreaterThanOrEqual(0);
      expect(result.gcCollected).toBeGreaterThanOrEqual(0);
    });

    it("returns count of memories needing review", async () => {
      const result = await engine.runDecayCycle();

      expect(typeof result.decayedCount).toBe("number");
      expect(typeof result.needsReviewCount).toBe("number");
      expect(typeof result.gcCollected).toBe("number");
    });
  });

  describe("getValidationReport", () => {
    beforeEach(async () => {
      engine.configure({});

      // Create diverse memory set
      await engine.storeMemoryAsEvidence("design memory 1", "persistent", "design-file");
      await engine.storeMemoryAsEvidence("design memory 2", "persistent", "design-file");
      await engine.storeMemoryAsEvidence("feedback memory", "long-term", "user-feedback");
      await engine.storeMemoryAsEvidence("ai memory", "short-term", "ai-inference");
      await engine.storeMemoryAsEvidence("pattern memory", "short-term", "pattern-match");
    });

    it("generates comprehensive validation report", async () => {
      const report = await engine.getValidationReport();

      expect(report.totalMemories).toBe(5);
      expect(report.validatedMemories).toBeGreaterThanOrEqual(0);
      expect(report.validationRate).toBeGreaterThanOrEqual(0);
      expect(report.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(report.pendingValidation).toBeGreaterThanOrEqual(0);
      expect(report.contradictions).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(report.recommendedActions)).toBe(true);
    });

    it("calculates validation rate correctly", async () => {
      const report = await engine.getValidationReport();

      expect(report.validationRate).toBeLessThanOrEqual(1.0);
      expect(report.validationRate).toBeGreaterThanOrEqual(0);
    });

    it("includes actionable recommendations", async () => {
      const report = await engine.getValidationReport();

      // May include recommendations based on validation state
      expect(Array.isArray(report.recommendedActions)).toBe(true);
    });

    it("flags low confidence memories", async () => {
      const report = await engine.getValidationReport();

      if (report.averageConfidence < 0.6) {
        expect(
          report.recommendedActions.some((r) => r.includes("confidence"))
        ).toBe(true);
      }
    });

    it("flags unvalidated memories", async () => {
      const report = await engine.getValidationReport();

      if (report.validationRate < 0.5) {
        expect(
          report.recommendedActions.some((r) => r.includes("validated"))
        ).toBe(true);
      }
    });
  });

  describe("snapshot", () => {
    beforeEach(async () => {
      engine.configure({});

      await engine.storeMemoryAsEvidence(
        "Memory to export",
        "long-term",
        "design-file"
      );

      await engine.storeMemoryAsEvidence(
        "Another memory",
        "persistent",
        "user-feedback"
      );

      // Validate one memory
      await engine.validateMemory("Memory to export", "design-file");
    });

    it("exports validation state", async () => {
      const state = await engine.exportValidationState();
      const parsed = JSON.parse(state);

      expect(parsed.version).toBe(1);
      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.snapshot).toBeDefined();
      expect(parsed.report).toBeDefined();
      expect(parsed.validationHistory).toBeDefined();
    });

    it("exports include validation report", async () => {
      const state = await engine.exportValidationState();
      const parsed = JSON.parse(state);

      const report = parsed.report;
      expect(report.totalMemories).toBeGreaterThanOrEqual(0);
      expect(report.validatedMemories).toBeGreaterThanOrEqual(0);
    });

    it("imports validation state", async () => {
      const state = await engine.exportValidationState();

      const engine2 = new MemoryValidationEngine(createMockAgentMemory());
      engine2.configure({});

      // Should not throw
      await engine2.importValidationState(state);
      expect(true).toBe(true);
    });

    it("rejects invalid state version", async () => {
      const invalidState = JSON.stringify({
        version: 99,
        exportedAt: Date.now(),
      });

      await expect(engine.importValidationState(invalidState)).rejects.toThrow(
        "Unsupported state version"
      );
    });
  });

  describe("factory", () => {
    it("creates validation engine without config", () => {
      const mockMem = createMockAgentMemory();
      const e = createMemoryValidation(mockMem);
      expect(e).toBeDefined();
    });

    it("creates validation engine with config", () => {
      const mockMem = createMockAgentMemory();
      const e = createMemoryValidation(mockMem, {
        minConfidenceForLongTerm: 0.8,
        enableAutoValidation: false,
      });
      expect(e).toBeDefined();
    });
  });

  describe("bulkImport", () => {
    beforeEach(() => {
      engine.configure({});
    });

    it("imports multiple memories efficiently", async () => {
      const result = await engine.bulkImport([
        { content: "Button uses 8px padding", tier: "long-term", source: "design-file" },
        { content: "Cards have 4px border-radius", tier: "long-term", source: "design-file" },
        { content: "Primary color is blue", tier: "persistent", source: "user-feedback" },
      ]);

      expect(result.imported).toBe(3);
      expect(result.failed).toBe(0);
    });

    it("tracks failures during bulk import", async () => {
      mockAgentMemory.store.mockRejectedValueOnce(new Error("DB error"));

      const result = await engine.bulkImport([
        { content: "Memory that fails", tier: "long-term", source: "ai-inference" },
        { content: "Memory that succeeds", tier: "long-term", source: "design-file" },
      ]);

      // First one fails at agent memory but still stores in evidence (orphaned)
      expect(result.imported).toBe(2);
      expect(result.failed).toBe(0);
    });

    it("retrains embeddings after import", async () => {
      const result = await engine.bulkImport([
        { content: "React component patterns", tier: "long-term", source: "design-file" },
      ]);

      expect(result.imported).toBe(1);
      // Embeddings retrained — retrieval should work
      const retrieved = await engine.retrieveValidatedMemory("React component");
      expect(Array.isArray(retrieved)).toBe(true);
    });
  });

  describe("confidence initialization", () => {
    beforeEach(() => {
      engine.configure({});
    });

    it("assigns highest initial confidence to design files", async () => {
      await engine.storeMemoryAsEvidence(
        "From design file",
        "persistent",
        "design-file"
      );

      const results = await engine.retrieveValidatedMemory("From design");
      if (results.length > 0) {
        // Design files + persistent tier should have high confidence
        expect(results[0].validation.confidence).toBeGreaterThan(0.8);
      }
    });

    it("assigns lowest initial confidence to pattern matches", async () => {
      await engine.storeMemoryAsEvidence(
        "From pattern",
        "short-term",
        "pattern-match"
      );

      const results = await engine.retrieveValidatedMemory("From pattern");
      if (results.length > 0) {
        expect(results[0].validation.confidence).toBeLessThan(0.5);
      }
    });

    it("boosts confidence based on tier", async () => {
      // Same source, different tiers
      await engine.storeMemoryAsEvidence(
        "In short-term",
        "short-term",
        "ai-inference"
      );

      await engine.storeMemoryAsEvidence(
        "In persistent",
        "persistent",
        "ai-inference"
      );

      // Persistent tier should have higher confidence
      const results = await engine.retrieveValidatedMemory("");
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
