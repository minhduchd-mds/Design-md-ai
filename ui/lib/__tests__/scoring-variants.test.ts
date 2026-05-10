import { describe, it, expect } from "vitest";
import { scoreVariants } from "../scoring-variants";
import type { SerializedNode } from "../../../shared/types";

function makeNode(name: string, overrides?: Partial<SerializedNode>): SerializedNode {
  return { id: Math.random().toString(36), name, type: "FRAME", ...overrides };
}

function makeInstance(componentName: string, overrides?: Partial<SerializedNode>): SerializedNode {
  return makeNode(componentName, { isInstance: true, componentName, ...overrides });
}

describe("scoreVariants", () => {
  it("returns base score for nodes without instances", () => {
    const node = makeNode("plain-frame");
    const result = scoreVariants(node);
    expect(result.score).toBe(70);
    expect(result.issues).toHaveLength(0);
  });

  it("rewards instances with size variants", () => {
    const node = makeNode("card", {
      children: [
        makeInstance("Button", {
          availableVariants: { Size: ["Small", "Medium", "Large"], State: ["Default", "Hover"] },
        }),
      ],
    });

    const result = scoreVariants(node);
    expect(result.score).toBeGreaterThan(70);
  });

  it("scores lower without size variants", () => {
    // Instances with state but no size
    const withoutSize = makeNode("form-a", {
      children: [
        makeInstance("Button", { availableVariants: { State: ["Default", "Hover"] } }),
      ],
    });
    // Instance with both size and state
    const withSize = makeNode("form-b", {
      children: [
        makeInstance("Button", { availableVariants: { Size: ["S", "M", "L"], State: ["Default", "Hover"] } }),
      ],
    });

    const scoreWithout = scoreVariants(withoutSize).score;
    const scoreWith = scoreVariants(withSize).score;
    // Having size variants should score equal or higher
    expect(scoreWith).toBeGreaterThanOrEqual(scoreWithout);
  });

  it("penalizes cryptic property names", () => {
    const node = makeNode("section", {
      children: [
        makeInstance("Widget", {
          availableVariants: { "Property 1": ["A", "B"], "Property 2": ["X", "Y"] },
        }),
      ],
    });

    const result = scoreVariants(node);
    const crypticIssue = result.issues.find((i) => i.id.includes("cryptic"));
    expect(crypticIssue).toBeDefined();
  });

  it("rewards clean property naming", () => {
    const node = makeNode("navbar", {
      children: [
        makeInstance("Button", {
          availableVariants: { Size: ["Small", "Medium"], State: ["Default", "Hover", "Disabled"] },
        }),
      ],
    });

    const result = scoreVariants(node);
    // Size + State + clean names → high score
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("rewards root component having variants", () => {
    const node = makeNode("Button", {
      availableVariants: { Size: ["S", "M", "L"], State: ["Default", "Hover"] },
      children: [],
    });

    const result = scoreVariants(node);
    expect(result.score).toBeGreaterThan(70);
  });
});
