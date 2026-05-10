import { describe, it, expect } from "vitest";
import { scoreMeta } from "../scoring-meta";
import type { SerializedNode } from "../../../shared/types";

function makeNode(name: string, overrides?: Partial<SerializedNode>): SerializedNode {
  return { id: Math.random().toString(36), name, type: "FRAME", ...overrides };
}

describe("scoreMeta", () => {
  it("returns high score for clean tree", () => {
    const node = makeNode("card", {
      width: 375,
      children: [
        makeNode("title", { type: "TEXT", characters: "Hello" }),
        makeNode("body", { type: "TEXT", characters: "World" }),
      ],
    });
    const result = scoreMeta(node);
    expect(result.score).toBe(80);
    expect(result.issues).toHaveLength(0);
    expect(result.stats.viewport?.type).toBe("mobile");
  });

  it("penalizes hidden layers", () => {
    const node = makeNode("card", {
      width: 375,
      children: [
        makeNode("visible", { type: "TEXT", characters: "Hi" }),
        makeNode("hidden-layer", { visible: false }),
      ],
    });
    const result = scoreMeta(node);
    expect(result.score).toBeLessThan(80);
    expect(result.stats.hiddenLayers).toBe(1);
    expect(result.issues.some((i) => i.id.startsWith("meta-hidden-"))).toBe(true);
  });

  it("detects empty placeholder frames", () => {
    const node = makeNode("wrapper", {
      width: 1440,
      children: [makeNode("forgotten-frame", { type: "FRAME", width: 100, height: 100 })],
    });
    const result = scoreMeta(node);
    expect(result.issues.some((i) => i.id.startsWith("meta-empty-"))).toBe(true);
    expect(result.stats.emptyFrames).toBe(1);
  });

  it("does not flag empty frames inside instances as deletable", () => {
    // Empty frames inside an instance are read-only in Figma and cannot be
    // removed by the Quick Fix delete button. They must not appear as issues
    // (regression guard for the "0 nodes deleted" bug).
    const node = makeNode("instance-wrapper", {
      width: 375,
      isInstance: true,
      children: [makeNode("empty-slot", { type: "FRAME", width: 100, height: 100 })],
    });
    const result = scoreMeta(node);
    expect(result.issues.some((i) => i.id.startsWith("meta-empty-"))).toBe(false);
    expect(result.stats.emptyFrames).toBe(0);
  });

  it("detects divider frames", () => {
    const node = makeNode("section", {
      width: 375,
      children: [
        makeNode("divider", {
          type: "FRAME",
          width: 340,
          height: 1,
          fills: [{ type: "SOLID", color: { r: 200, g: 200, b: 200 } }],
        }),
      ],
    });
    const result = scoreMeta(node);
    expect(result.issues.some((i) => i.id.startsWith("meta-divider-frame-"))).toBe(true);
  });

  it("classifies mid-desktop widths (1025-1199px) as desktop, no penalty", () => {
    // Regression guard for v1.1.1: previously 1025-1199 fell into "unknown" here
    // because scoring-meta carried a local duplicate of the viewport cascade.
    const node = makeNode("mid-desktop-frame", { width: 1100 });
    const result = scoreMeta(node);
    expect(result.stats.viewport?.type).toBe("desktop");
    expect(result.issues.some((i) => i.id.startsWith("meta-unknown-viewport-"))).toBe(false);
  });

  it("detects inconsistent spacing", () => {
    const node = makeNode("container", {
      width: 375,
      children: [
        makeNode("a", { y: 0, height: 20 }),
        makeNode("b", { y: 30, height: 20 }),
        makeNode("c", { y: 70, height: 20 }),
        makeNode("d", { y: 120, height: 20 }),
      ],
    });
    const result = scoreMeta(node);
    expect(result.issues.some((i) => i.id.startsWith("meta-inconsistent-spacing-"))).toBe(true);
  });

  it("skips properly converted dividers", () => {
    const node = makeNode("section", {
      width: 375,
      children: [
        makeNode("divider", {
          type: "FRAME",
          width: 340,
          height: 1,
          // no fills = already converted
        }),
      ],
    });
    const result = scoreMeta(node);
    expect(result.issues.filter((i) => i.id.startsWith("meta-divider-frame-"))).toHaveLength(0);
  });
});
