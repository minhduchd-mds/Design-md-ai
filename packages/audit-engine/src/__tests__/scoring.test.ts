/**
 * scoring — unit tests for score calculation and summarization.
 */

import { describe, it, expect } from "vitest";
import { calculateScore, summarize } from "../scoring.js";
import type { AuditIssue } from "../types.js";

function issue(overrides: Partial<AuditIssue> = {}): AuditIssue {
  return {
    id: "i1",
    ruleId: "contrast.text",
    wcagCriterion: "1.4.3",
    category: "contrast",
    severity: "moderate",
    nodeId: "n1",
    nodeName: "Node",
    nodeType: "TEXT",
    message: "msg",
    ...overrides,
  };
}

describe("calculateScore", () => {
  it("returns 100 for zero issues", () => {
    expect(calculateScore([])).toBe(100);
  });

  it("deducts 10 per critical issue", () => {
    expect(calculateScore([issue({ severity: "critical" })])).toBe(90);
  });

  it("deducts 5 per serious issue", () => {
    expect(calculateScore([issue({ severity: "serious" })])).toBe(95);
  });

  it("deducts 2 per moderate issue", () => {
    expect(calculateScore([issue({ severity: "moderate" })])).toBe(98);
  });

  it("deducts 0.5 per minor issue and rounds", () => {
    expect(calculateScore([issue({ severity: "minor" })])).toBe(100); // 99.5 → 100
    expect(calculateScore([issue({ severity: "minor" }), issue({ severity: "minor" })])).toBe(99);
  });

  it("never goes below 0", () => {
    const many = Array.from({ length: 50 }, () => issue({ severity: "critical" }));
    expect(calculateScore(many)).toBe(0);
  });

  it("combines mixed severities", () => {
    // 10 + 5 + 2 + 0.5 = 17.5 → round(82.5) = 82 (banker's? no, Math.round → 83)
    const score = calculateScore([
      issue({ severity: "critical" }),
      issue({ severity: "serious" }),
      issue({ severity: "moderate" }),
      issue({ severity: "minor" }),
    ]);
    expect(score).toBe(83); // 100 - 17.5 = 82.5, Math.round → 83
  });
});

describe("summarize", () => {
  it("returns all-zero summary for empty issues", () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.critical).toBe(0);
    expect(s.serious).toBe(0);
    expect(s.moderate).toBe(0);
    expect(s.minor).toBe(0);
  });

  it("counts by severity", () => {
    const s = summarize([
      issue({ severity: "critical" }),
      issue({ severity: "critical" }),
      issue({ severity: "minor" }),
    ]);
    expect(s.critical).toBe(2);
    expect(s.minor).toBe(1);
    expect(s.total).toBe(3);
  });

  it("counts by category", () => {
    const s = summarize([
      issue({ category: "contrast" }),
      issue({ category: "contrast" }),
      issue({ category: "aria" }),
    ]);
    expect(s.byCategory.contrast).toBe(2);
    expect(s.byCategory.aria).toBe(1);
    expect(s.byCategory.keyboard).toBe(0);
  });

  it("initializes all 7 categories to 0", () => {
    const s = summarize([]);
    expect(Object.keys(s.byCategory).sort()).toEqual(
      ["aria", "contrast", "heading", "keyboard", "motion", "semantic", "touch-target"],
    );
  });
});
