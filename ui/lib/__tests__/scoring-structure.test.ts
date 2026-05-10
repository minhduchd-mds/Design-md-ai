import { describe, it, expect } from "vitest";
import { scoreStructure } from "../scoring-structure";
import type { SerializedNode } from "../../../shared/types";

function makeNode(name: string, overrides?: Partial<SerializedNode>): SerializedNode {
  return { id: Math.random().toString(36), name, type: "FRAME", ...overrides };
}

describe("scoreStructure", () => {
  it("rewards full Auto Layout usage", () => {
    const node = makeNode("card", {
      layoutMode: "VERTICAL",
      children: [
        makeNode("header", { layoutMode: "HORIZONTAL" }),
        makeNode("body", { layoutMode: "VERTICAL" }),
      ],
    });

    const result = scoreStructure(node);
    // base 50 + autoLayoutRatio >=0.9 (35) + root has layout (10) = 95
    expect(result.score).toBe(95);
    expect(result.issues).toHaveLength(0);
  });

  it("penalizes missing Auto Layout on root with children", () => {
    const node = makeNode("section", {
      width: 500,
      children: [
        makeNode("child-a", { layoutMode: "HORIZONTAL" }),
        makeNode("child-b", { layoutMode: "VERTICAL" }),
      ],
    });

    const result = scoreStructure(node);
    // root has no auto layout => -3, plus warning
    expect(result.score).toBeLessThan(95);
    const rootWarning = result.issues.find((i) => i.id.includes("root-no-autolayout"));
    expect(rootWarning).toBeDefined();
  });

  it("flags deep nesting (>8 levels)", () => {
    // Build a chain of 10 nested frames
    let deepest = makeNode("deep-leaf");
    for (let i = 9; i >= 1; i--) {
      deepest = makeNode(`level-${i}`, { children: [deepest] });
    }
    const root = makeNode("root", { layoutMode: "VERTICAL", children: [deepest] });

    const result = scoreStructure(root);
    const deepIssue = result.issues.find((i) => i.id.includes("deep-nesting"));
    expect(deepIssue).toBeDefined();
  });

  it("flags Groups with >2 children", () => {
    const node = makeNode("container", {
      layoutMode: "VERTICAL",
      children: [
        makeNode("my-group", {
          type: "GROUP",
          children: [makeNode("a"), makeNode("b"), makeNode("c")],
        }),
      ],
    });

    const result = scoreStructure(node);
    const groupIssue = result.issues.find((i) => i.id.includes("structure-group"));
    expect(groupIssue).toBeDefined();
    expect(groupIssue!.message).toContain("Group");
  });

  it("rewards Layout Grid on wide frames", () => {
    const node = makeNode("page", {
      width: 1440,
      layoutMode: "VERTICAL",
      layoutGrids: [{ pattern: "COLUMNS", count: 12, gutterSize: 20 }],
    });

    const result = scoreStructure(node);
    // base 50 + autoLayoutRatio (only 1 frame: 100%) => 35 + root layout (10) + grid (5) = 100
    expect(result.score).toBe(100);
  });

  it("flags wide frames without Layout Grid", () => {
    const node = makeNode("page", {
      width: 1440,
      layoutMode: "VERTICAL",
    });

    const result = scoreStructure(node);
    const gridIssue = result.issues.find((i) => i.id.includes("no-grid"));
    expect(gridIssue).toBeDefined();
  });

  it("returns base score for zero frames", () => {
    const node = makeNode("text-only", { type: "TEXT", characters: "Hello" });
    const result = scoreStructure(node);
    expect(result.score).toBe(50);
  });

  it("flags absolute positioning with multiple children", () => {
    const node = makeNode("absolute-container", {
      children: [
        makeNode("child-1"),
        makeNode("child-2"),
        makeNode("child-3"),
      ],
    });

    const result = scoreStructure(node);
    const absIssue = result.issues.find((i) => i.id.includes("no-autolayout") && !i.id.includes("root"));
    expect(absIssue).toBeDefined();
  });
});
