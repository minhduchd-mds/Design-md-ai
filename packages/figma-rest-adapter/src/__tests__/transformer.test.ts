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
