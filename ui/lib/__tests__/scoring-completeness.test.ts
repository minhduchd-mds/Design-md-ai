import { describe, it, expect } from "vitest";
import { scoreCompleteness } from "../scoring-completeness";
import type { SerializedNode } from "../../../shared/types";

function makeNode(name: string, overrides?: Partial<SerializedNode>): SerializedNode {
  return { id: Math.random().toString(36), name, type: "FRAME", ...overrides };
}

describe("scoreCompleteness", () => {
  it("returns high score for node without interactive components", () => {
    const node = makeNode("card", {
      children: [
        makeNode("title", { type: "TEXT", characters: "Hello" }),
        makeNode("body", { type: "TEXT", characters: "Content" }),
      ],
    });
    const result = scoreCompleteness(node);
    expect(result.score).toBe(90);
    expect(result.issues).toHaveLength(0);
  });

  it("detects missing states on interactive components", () => {
    const node = makeNode("form", {
      children: [
        makeNode("submit-button", {
          type: "INSTANCE",
          isInstance: true,
          componentName: "Button",
          availableVariants: {
            State: ["Default"],
          },
        }),
      ],
    });
    const result = scoreCompleteness(node);
    expect(result.score).toBeLessThan(90);
    expect(result.issues.some((i) => i.id.startsWith("completeness-missing-states-"))).toBe(true);
  });

  it("detects missing focus state", () => {
    const node = makeNode("form", {
      children: [
        makeNode("input-field", {
          type: "INSTANCE",
          isInstance: true,
          componentName: "Input",
          availableVariants: {
            State: ["Default", "Hover", "Disabled"],
          },
        }),
      ],
    });
    const result = scoreCompleteness(node);
    expect(result.issues.some((i) => i.id.startsWith("completeness-no-focus-"))).toBe(true);
  });

  it("detects interactive component without State property", () => {
    const node = makeNode("nav", {
      children: [
        makeNode("link-item", {
          type: "INSTANCE",
          isInstance: true,
          componentName: "Link",
          availableVariants: {
            Size: ["Small", "Large"],
          },
        }),
      ],
    });
    const result = scoreCompleteness(node);
    expect(result.issues.some((i) => i.id.startsWith("completeness-no-state-prop-"))).toBe(true);
  });

  it("detects cryptic property names", () => {
    const node = makeNode("component", {
      children: [
        makeNode("widget", {
          type: "INSTANCE",
          isInstance: true,
          componentName: "Widget",
          availableVariants: {
            "Property 1": ["A", "B"],
            State: ["Default", "Hover", "Disabled"],
          },
        }),
      ],
    });
    const result = scoreCompleteness(node);
    expect(result.issues.some((i) => i.id.includes("cryptic-prop"))).toBe(true);
  });

  it("gives full marks when all states present on interactive component", () => {
    const node = makeNode("card", {
      children: [
        makeNode("cta", {
          type: "INSTANCE",
          isInstance: true,
          componentName: "Button",
          availableVariants: {
            State: ["Default", "Hover", "Disabled", "Focus"],
          },
        }),
      ],
    });
    const result = scoreCompleteness(node);
    expect(result.score).toBe(90);
    expect(result.issues).toHaveLength(0);
  });
});
