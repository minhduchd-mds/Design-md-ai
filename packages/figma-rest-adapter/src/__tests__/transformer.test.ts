/**
 * transformFigmaToAuditNodes — document tree → AuditNode[] tests.
 */

import { describe, it, expect } from "vitest";
import { transformFigmaToAuditNodes } from "../transformer.js";

// Minimal Figma document fixture
const doc = {
  type: "DOCUMENT",
  children: [
    {
      id: "0:1",
      name: "Page 1",
      type: "CANVAS",
      children: [
        {
          id: "1:2",
          name: "Submit Button",
          type: "INSTANCE",
          absoluteBoundingBox: { width: 120, height: 40 },
          children: [],
        },
        {
          id: "1:3",
          name: "H1 Title",
          type: "TEXT",
          characters: "Welcome",
          style: { fontSize: 42 },
          absoluteBoundingBox: { width: 200, height: 50 },
        },
        {
          id: "1:4",
          name: "Hidden",
          type: "FRAME",
          visible: false,
          children: [{ id: "1:5", name: "child", type: "TEXT", characters: "x" }],
        },
      ],
    },
  ],
};

describe("transformFigmaToAuditNodes", () => {
  it("emits nodes from canvas children", () => {
    const nodes = transformFigmaToAuditNodes(doc);
    const ids = nodes.map((n) => n.id);
    expect(ids).toContain("1:2");
    expect(ids).toContain("1:3");
  });

  it("attaches pageName from the canvas", () => {
    const nodes = transformFigmaToAuditNodes(doc);
    const button = nodes.find((n) => n.id === "1:2");
    expect(button?.pageName).toBe("Page 1");
  });

  it("skips invisible nodes and their children", () => {
    const nodes = transformFigmaToAuditNodes(doc);
    expect(nodes.find((n) => n.id === "1:4")).toBeUndefined();
    expect(nodes.find((n) => n.id === "1:5")).toBeUndefined();
  });

  it("infers interactivity from name keywords", () => {
    const nodes = transformFigmaToAuditNodes(doc);
    const button = nodes.find((n) => n.id === "1:2");
    expect(button?.hasInteractions).toBe(true);
    expect(button?.inferredRole).toBe("button");
  });

  it("infers heading level from name and font size", () => {
    const nodes = transformFigmaToAuditNodes(doc);
    const title = nodes.find((n) => n.id === "1:3");
    expect(title?.headingLevel).toBe(1);
  });

  it("computes touch target compliance", () => {
    const nodes = transformFigmaToAuditNodes(doc);
    const button = nodes.find((n) => n.id === "1:2");
    expect(button?.touchTargetCompliant).toBe(true); // 40 >= 24
  });

  it("returns empty array for empty document", () => {
    expect(transformFigmaToAuditNodes({})).toEqual([]);
    expect(transformFigmaToAuditNodes(null)).toEqual([]);
  });

  it("computes contrast ratio for text against an ancestor background", () => {
    const tree = {
      type: "DOCUMENT",
      children: [
        {
          id: "0:1", name: "Page", type: "CANVAS",
          children: [
            {
              id: "frame", name: "Card", type: "FRAME",
              // white background
              fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
              children: [
                {
                  id: "txt", name: "Label", type: "TEXT", characters: "Hi",
                  // black text
                  fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
                },
              ],
            },
          ],
        },
      ],
    };
    const nodes = transformFigmaToAuditNodes(tree);
    const txt = nodes.find((n) => n.id === "txt");
    // black on white ≈ 21:1
    expect(txt?.contrastRatio).toBeGreaterThan(20);
  });

  it("leaves contrastRatio undefined when no background is known", () => {
    const tree = {
      type: "DOCUMENT",
      children: [
        {
          id: "0:1", name: "Page", type: "CANVAS",
          children: [
            { id: "txt", name: "Label", type: "TEXT", characters: "Hi",
              fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }] },
          ],
        },
      ],
    };
    const nodes = transformFigmaToAuditNodes(tree);
    expect(nodes.find((n) => n.id === "txt")?.contrastRatio).toBeUndefined();
  });

  it("captures fontSize and fontWeight for large-text classification", () => {
    const tree = {
      type: "DOCUMENT",
      children: [
        {
          id: "0:1", name: "Page", type: "CANVAS",
          children: [
            { id: "txt", name: "H1", type: "TEXT", characters: "Title",
              style: { fontSize: 42, fontWeight: 700 } },
          ],
        },
      ],
    };
    const nodes = transformFigmaToAuditNodes(tree);
    const txt = nodes.find((n) => n.id === "txt");
    expect(txt?.fontSize).toBe(42);
    expect(txt?.fontWeight).toBe(700);
  });

  it("detects interactivity from an ON_CLICK reaction (not just name)", () => {
    const tree = {
      type: "DOCUMENT",
      children: [
        {
          id: "0:1", name: "Page", type: "CANVAS",
          children: [
            // Generic name, but has a click reaction → should be interactive
            { id: "r1", name: "Rectangle 5", type: "FRAME",
              reactions: [{ trigger: { type: "ON_CLICK" }, action: { type: "NODE" } }] },
          ],
        },
      ],
    };
    const node = transformFigmaToAuditNodes(tree).find((n) => n.id === "r1");
    expect(node?.hasInteractions).toBe(true);
  });

  it("does not mark a non-interactive trigger (AFTER_TIMEOUT) as interactive", () => {
    const tree = {
      type: "DOCUMENT",
      children: [
        {
          id: "0:1", name: "Page", type: "CANVAS",
          children: [
            { id: "r1", name: "Banner", type: "FRAME",
              reactions: [{ trigger: { type: "AFTER_TIMEOUT" }, action: { type: "NODE" } }] },
          ],
        },
      ],
    };
    const node = transformFigmaToAuditNodes(tree).find((n) => n.id === "r1");
    expect(node?.hasInteractions).toBe(false);
  });

  it("detects motion from a SMART_ANIMATE transition", () => {
    const tree = {
      type: "DOCUMENT",
      children: [
        {
          id: "0:1", name: "Page", type: "CANVAS",
          children: [
            { id: "m1", name: "Carousel", type: "FRAME",
              reactions: [{
                trigger: { type: "AFTER_TIMEOUT" },
                action: { type: "NODE", transition: { type: "SMART_ANIMATE" } },
              }] },
          ],
        },
      ],
    };
    const node = transformFigmaToAuditNodes(tree).find((n) => n.id === "m1");
    expect(node?.hasMotion).toBe(true);
  });

  it("supports the plural actions[] shape for motion + interactivity", () => {
    const tree = {
      type: "DOCUMENT",
      children: [
        {
          id: "0:1", name: "Page", type: "CANVAS",
          children: [
            { id: "m2", name: "Slide", type: "FRAME",
              reactions: [{
                trigger: { type: "ON_CLICK" },
                actions: [{ type: "NODE", transition: { type: "PUSH" } }],
              }] },
          ],
        },
      ],
    };
    const node = transformFigmaToAuditNodes(tree).find((n) => n.id === "m2");
    expect(node?.hasMotion).toBe(true);
    expect(node?.hasInteractions).toBe(true);
  });

  it("leaves hasMotion false when there are no reactions", () => {
    const tree = {
      type: "DOCUMENT",
      children: [
        { id: "0:1", name: "Page", type: "CANVAS",
          children: [{ id: "s1", name: "Static", type: "FRAME" }] },
      ],
    };
    const node = transformFigmaToAuditNodes(tree).find((n) => n.id === "s1");
    expect(node?.hasMotion).toBe(false);
  });

  it("respects maxDepth", () => {
    const deep = {
      type: "DOCUMENT",
      children: [
        {
          id: "0:1", name: "P", type: "CANVAS",
          children: [
            { id: "a", name: "a", type: "FRAME", children: [
              { id: "b", name: "b", type: "FRAME", children: [
                { id: "c", name: "c", type: "TEXT", characters: "deep" },
              ] },
            ] },
          ],
        },
      ],
    };
    const shallow = transformFigmaToAuditNodes(deep, { maxDepth: 1 });
    // depth 0 = canvas, depth 1 = 'a'; 'b' and 'c' beyond maxDepth
    expect(shallow.find((n) => n.id === "c")).toBeUndefined();
  });
});
