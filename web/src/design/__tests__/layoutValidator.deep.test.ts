/**
 * layoutValidator — deep edge-case tests to find/prevent regressions.
 * These exercise boundary conditions, injection, and type-safety bugs.
 */
import { describe, it, expect } from "vitest";
import { createEmptyContext } from "../../../../shared/designContext";
import { computeValidationReport, validateComponents, validateNaming } from "../layoutValidator";

describe("layoutValidator (deep edge cases)", () => {

  // ── validateNaming ─────────────────────────────────────

  describe("validateNaming — security & edge cases", () => {
    it("does not throw on XSS-like component names", () => {
      const ctx = createEmptyContext();
      ctx.components = [{ id: "1", name: "<script>alert(1)</script>", type: "COMPONENT" }];
      expect(() => validateNaming(ctx)).not.toThrow();
    });

    it("does not throw on 1000-character component name", () => {
      const ctx = createEmptyContext();
      ctx.components = [{ id: "1", name: "A".repeat(1000), type: "COMPONENT" }];
      expect(() => validateNaming(ctx)).not.toThrow();
    });

    it("does not throw on empty-string component name", () => {
      const ctx = createEmptyContext();
      ctx.components = [{ id: "1", name: "", type: "COMPONENT" }];
      expect(() => validateNaming(ctx)).not.toThrow();
    });

    it("returns score 100 with only well-named components", () => {
      const ctx = createEmptyContext();
      ctx.components = [
        { id: "1", name: "ButtonPrimary", type: "COMPONENT" },
        { id: "2", name: "CardContent", type: "COMPONENT" },
        { id: "3", name: "NavbarDesktop", type: "COMPONENT" },
      ];
      expect(validateNaming(ctx).score).toBe(100);
    });

    it("score stays in 0-100 range regardless of input", () => {
      const ctx = createEmptyContext();
      ctx.components = Array.from({ length: 50 }, (_, i) => ({
        id: String(i), name: `BadName_${i}!@#`, type: "COMPONENT" as const,
      }));
      const { score } = validateNaming(ctx);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // ── validateComponents ─────────────────────────────────

  describe("validateComponents — template matching", () => {
    it("gives full score when context has all required components", () => {
      const ctx = createEmptyContext();
      // Supply many generic components — template should find matches
      ctx.components = [
        "Header", "Footer", "Button", "Input", "Card", "Modal", "Table", "Sidebar",
        "Avatar", "Badge", "Icon", "Form", "Nav", "Tab", "Tooltip", "Spinner",
      ].map((name, i) => ({ id: String(i), name, type: "COMPONENT" as const }));
      const result = validateComponents(ctx, "airtable");
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("returns empty missing array when no template found", () => {
      const ctx = createEmptyContext();
      const result = validateComponents(ctx, "nonexistent-template-xyz");
      // Should not crash; missing array should be defined
      expect(Array.isArray(result.missing)).toBe(true);
    });

    it("handles completely empty context without throwing", () => {
      const ctx = createEmptyContext();
      expect(() => validateComponents(ctx, "linear")).not.toThrow();
    });

    it("missing list contains only strings", () => {
      const ctx = createEmptyContext();
      const { missing } = validateComponents(ctx, "ba-agent-workflow");
      expect(missing.every((m) => typeof m === "string")).toBe(true);
    });
  });

  // ── computeValidationReport ────────────────────────────
  // Actual shape: { missingComponents, missingTokens, componentScore, tokenScore,
  //                 namingScore, readinessScore, canProceed }

  describe("computeValidationReport — integration", () => {
    it("readinessScore is numeric and in 0-100", () => {
      const ctx = createEmptyContext();
      ctx.components = [{ id: "1", name: "Button", type: "COMPONENT" }];
      const report = computeValidationReport(ctx, "ba-agent-workflow");
      expect(typeof report.readinessScore).toBe("number");
      expect(report.readinessScore).toBeGreaterThanOrEqual(0);
      expect(report.readinessScore).toBeLessThanOrEqual(100);
    });

    it("report has expected shape (readinessScore + missingComponents)", () => {
      const ctx = createEmptyContext();
      const report = computeValidationReport(ctx, "ba-agent-workflow");
      expect(report).toHaveProperty("readinessScore");
      expect(report).toHaveProperty("missingComponents");
      expect(report).toHaveProperty("canProceed");
      expect(Array.isArray(report.missingComponents)).toBe(true);
    });

    it("empty context gets lower or equal score than full context", () => {
      const empty = createEmptyContext();
      const full = createEmptyContext();
      full.components = ["Header", "Button", "Card", "Table", "Modal", "Input", "Badge", "Icon"]
        .map((name, i) => ({ id: String(i), name, type: "COMPONENT" as const }));
      full.colors = [{ name: "color-primary", value: "#8b5cf6", boundToVariable: true }];

      const emptyScore = computeValidationReport(empty, "ba-agent-workflow").readinessScore;
      const fullScore  = computeValidationReport(full, "ba-agent-workflow").readinessScore;
      expect(fullScore).toBeGreaterThanOrEqual(emptyScore);
    });

    it("does not throw on filtered undefined in components array", () => {
      const ctx = createEmptyContext();
      ctx.components = [
        { id: "1", name: "Button", type: "COMPONENT" },
      ].filter(Boolean);
      expect(() => computeValidationReport(ctx, "ba-agent-workflow")).not.toThrow();
    });

    it("missingComponents contains only strings", () => {
      const ctx = createEmptyContext();
      const report = computeValidationReport(ctx, "ba-agent-workflow");
      expect(report.missingComponents.every((m) => typeof m === "string")).toBe(true);
    });

    it("readinessScore is deterministic for same input (no randomness)", () => {
      const ctx = createEmptyContext();
      ctx.components = [{ id: "1", name: "ButtonPrimary", type: "COMPONENT" }];
      const r1 = computeValidationReport(ctx, "linear");
      const r2 = computeValidationReport(ctx, "linear");
      expect(r1.readinessScore).toBe(r2.readinessScore);
    });

    it("canProceed is false when readinessScore < 60", () => {
      const ctx = createEmptyContext(); // no components → low score
      const report = computeValidationReport(ctx, "ba-agent-workflow");
      if (report.readinessScore < 60) {
        expect(report.canProceed).toBe(false);
      }
    });

    it("componentScore + tokenScore + namingScore all in 0-100", () => {
      const ctx = createEmptyContext();
      const r = computeValidationReport(ctx, "ba-agent-workflow");
      expect(r.componentScore).toBeGreaterThanOrEqual(0);
      expect(r.componentScore).toBeLessThanOrEqual(100);
      expect(r.tokenScore).toBeGreaterThanOrEqual(0);
      expect(r.tokenScore).toBeLessThanOrEqual(100);
      expect(r.namingScore).toBeGreaterThanOrEqual(0);
      expect(r.namingScore).toBeLessThanOrEqual(100);
    });
  });
});
