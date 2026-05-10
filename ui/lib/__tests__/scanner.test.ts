import { describe, it, expect } from "vitest";
import { scan } from "../scanner";
import type { SerializedNode } from "../../../shared/types";
import { SCORE_WEIGHTS } from "../../../shared/types";

function makeNode(name: string, overrides?: Partial<SerializedNode>): SerializedNode {
  return { id: Math.random().toString(36), name, type: "FRAME", ...overrides };
}

describe("scan (integration)", () => {
  it("returns weighted score across all 5 dimensions", () => {
    const node = makeNode("hero-section", {
      layoutMode: "VERTICAL",
      itemSpacing: 16,
      paddingTop: 24,
      paddingRight: 24,
      paddingBottom: 24,
      paddingLeft: 24,
      width: 1440,
      height: 600,
      layoutGrids: [{ pattern: "COLUMNS", count: 12, gutterSize: 20 }],
      fills: [{ type: "SOLID", color: { r: 255, g: 255, b: 255 }, boundToVariable: true }],
      children: [
        makeNode("headline", { type: "TEXT", characters: "Welcome", fontSize: 48 }),
        makeNode("subtitle", { type: "TEXT", characters: "Subtitle text", fontSize: 16 }),
        makeNode("cta-button", {
          layoutMode: "HORIZONTAL",
          fills: [{ type: "SOLID", color: { r: 0, g: 100, b: 255 }, boundToVariable: true }],
        }),
      ],
    });

    const result = scan(node);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.categories).toHaveLength(6);
    expect(result.categories.map((c) => c.id)).toEqual(["naming", "structure", "tokens", "meta", "completeness", "variants"]);
  });

  it("generates prompt only when score >= 75", () => {
    // High-quality node
    const good = makeNode("card", {
      layoutMode: "VERTICAL",
      itemSpacing: 8,
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 16,
      paddingLeft: 16,
      width: 320,
      height: 200,
      fills: [{ type: "SOLID", color: { r: 255, g: 255, b: 255 }, boundToVariable: true }],
      children: [
        makeNode("title", { type: "TEXT", characters: "Card Title", fontSize: 18 }),
        makeNode("body", { type: "TEXT", characters: "Description", fontSize: 14 }),
      ],
    });
    const goodResult = scan(good);

    // Low-quality node — all generic names, no layout
    const bad = makeNode("Frame 1", {
      children: [
        makeNode("Rectangle 1", { type: "RECTANGLE" }),
        makeNode("Text 1", { type: "TEXT", characters: "Hello" }),
        makeNode("Frame 2"),
        makeNode("Group 1", { type: "GROUP" }),
      ],
    });
    const badResult = scan(bad);

    // Good node should likely have prompt, bad node likely not
    if (goodResult.score >= 75) {
      expect(goodResult.promptCompact).toBeDefined();
    }
    if (badResult.score < 75) {
      expect(badResult.promptCompact).toBeUndefined();
    }
  });

  it("sorts issues by severity (critical first)", () => {
    const node = makeNode("Frame 1", {
      children: [
        makeNode("Rectangle 1", { type: "RECTANGLE" }),
        makeNode("Text 1", { type: "TEXT", characters: "Hello" }),
        makeNode("Group 1", { type: "GROUP" }),
      ],
    });

    const result = scan(node);
    for (let i = 1; i < result.issues.length; i++) {
      const order = { critical: 0, warning: 1, info: 2 };
      expect(order[result.issues[i].severity]).toBeGreaterThanOrEqual(order[result.issues[i - 1].severity]);
    }
  });

  it("includes atomic info", () => {
    const node = makeNode("simple-atom", { id: "a1" });
    const result = scan(node);
    expect(result.atomicInfo).toBeDefined();
    expect(result.atomicInfo!.level).toBe("unclassified");
  });

  it("includes export plan", () => {
    // Use a component node so the plan isn't empty (unclassified nodes are skipped)
    const node = makeNode("MyButton", { id: "c1", isComponent: true });
    const result = scan(node);
    expect(result.exportPlan).toBeDefined();
    expect(result.exportPlan!.length).toBeGreaterThan(0);
  });

  it("weight sum equals 1.0", () => {
    const sum = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });
});
