import { describe, it, expect } from "vitest";
import { scoreNaming } from "../scoring-naming";
import type { SerializedNode } from "../../../shared/types";

function makeNode(name: string, overrides?: Partial<SerializedNode>): SerializedNode {
  return { id: Math.random().toString(36), name, type: "FRAME", ...overrides };
}

describe("scoreNaming", () => {
  it("returns 100 for all semantic names", () => {
    const node = makeNode("hero-section", {
      children: [
        makeNode("headline", { type: "TEXT", characters: "Hello" }),
        makeNode("cta-button", { type: "FRAME" }),
        makeNode("background-image", { type: "RECTANGLE" }),
      ],
    });

    const result = scoreNaming(node);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.stats).toEqual({ total: 4, generic: 0, semantic: 4 });
  });

  it("returns 0 for all generic names", () => {
    const node = makeNode("Frame 1", {
      children: [
        makeNode("Text 2", { type: "TEXT", characters: "Hello" }),
        makeNode("Rectangle 1", { type: "RECTANGLE" }),
        makeNode("Group 3", { type: "GROUP" }),
      ],
    });

    const result = scoreNaming(node);
    expect(result.score).toBe(0);
    expect(result.issues).toHaveLength(4);
    expect(result.stats.generic).toBe(4);
  });

  it("scores mixed names proportionally", () => {
    const node = makeNode("card", {
      children: [
        makeNode("title", { type: "TEXT", characters: "Title" }),
        makeNode("Frame 1", { type: "FRAME" }),
        makeNode("Vector", { type: "VECTOR" }),
      ],
    });

    const result = scoreNaming(node);
    // 2 semantic (card, title) out of 4 total = 50%
    expect(result.score).toBe(50);
    expect(result.issues).toHaveLength(2);
    expect(result.stats).toEqual({ total: 4, generic: 2, semantic: 2 });
  });

  it("escalates to critical when <50% semantic", () => {
    const node = makeNode("Frame 1", {
      children: [
        makeNode("Rectangle 1", { type: "RECTANGLE" }),
        makeNode("Vector 2", { type: "VECTOR" }),
        makeNode("icon", { type: "FRAME" }),
      ],
    });

    const result = scoreNaming(node);
    // 1 semantic (icon) out of 4 = 25%
    expect(result.score).toBe(25);
    const criticals = result.issues.filter((i) => i.severity === "critical");
    expect(criticals.length).toBeGreaterThan(0);
    expect(criticals.length).toBeLessThanOrEqual(3);
  });

  it("suggests name for text nodes", () => {
    const node = makeNode("Text 1", {
      type: "TEXT",
      characters: "Sign up now",
    });

    const result = scoreNaming(node);
    expect(result.issues[0].suggestion).toContain("sign-up-now");
  });

  it("suggests name for rectangles based on dimensions", () => {
    const node = makeNode("Rectangle 1", {
      type: "RECTANGLE",
      width: 200,
      height: 1,
    });

    const result = scoreNaming(node);
    expect(result.issues[0].suggestion).toContain("divider");
  });

  it("handles empty node (no children)", () => {
    const node = makeNode("button");
    const result = scoreNaming(node);
    expect(result.score).toBe(100);
    expect(result.stats.total).toBe(1);
  });

  it("returns 100 for empty tree (score = 100, 0 nodes edge case)", () => {
    // A node with 0 total should not crash — but scoreNaming always counts root
    const node = makeNode("root");
    const result = scoreNaming(node);
    expect(result.score).toBe(100);
  });

  it("handles deeply nested trees", () => {
    const deep = makeNode("Frame 1", {
      children: [
        makeNode("Frame 2", {
          children: [
            makeNode("Frame 3", {
              children: [makeNode("label", { type: "TEXT", characters: "OK" })],
            }),
          ],
        }),
      ],
    });

    const result = scoreNaming(deep);
    // 1 semantic (label) out of 4 = 25%
    expect(result.score).toBe(25);
    expect(result.issues).toHaveLength(3);
  });
});
